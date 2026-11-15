const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { registerAuthRoutes, requireAdmin } = require('../auth');
const { hashPassword, createPasswordVerifier } = require('./password');

const PASSWORD = 'Clave ficticia de pruebas';
let passwordHash;
before(async () => { passwordHash = await hashPassword(PASSWORD); });

function buildRoutes(options = {}) {
  const routes = new Map();
  const app = {
    post(path, ...handlers) { routes.set(`POST ${path}`, handlers); },
    get(path, ...handlers) { routes.set(`GET ${path}`, handlers); },
  };
  registerAuthRoutes(app, {
    passwordHash,
    requireCsrf(req, res, next) {
      if (req.headers?.['x-csrf-token'] !== 'token-de-prueba') {
        return res.status(403).json({ error: 'CSRF invalido' });
      }
      next();
    },
    ...options,
  });
  return routes;
}

// Doble de express-session: regenerar reemplaza el objeto de sesion completo.
function attachSession(req, failures = {}) {
  const events = [];
  function newSession() {
    return {
      cookie: { path: '/', httpOnly: true, sameSite: 'lax', secure: false },
      regenerate(callback) {
        events.push('regenerate');
        if (failures.regenerate) return callback(failures.regenerate);
        req.session = newSession();
        callback();
      },
      save(callback) { events.push('save'); callback(failures.save); },
      destroy(callback) {
        events.push('destroy');
        if (!failures.destroy) delete req.session;
        callback(failures.destroy);
      },
    };
  }
  req.session = newSession();
  return events;
}

function invoke(handlers, req = {}) {
  return new Promise((resolve, reject) => {
    const res = {
      code: 200, headers: {}, cleared: [],
      set(name, value) { this.headers[name] = value; return this; },
      status(code) { this.code = code; return this; },
      clearCookie(...args) { this.cleared.push(args); return this; },
      json(body) { this.body = body; resolve(this); return this; },
    };
    let index = 0;
    function next(error) {
      if (error) return reject(error);
      const handler = handlers[index++];
      if (!handler) return resolve(res);
      try { Promise.resolve(handler(req, res, next)).catch(reject); }
      catch (failure) { reject(failure); }
    }
    next();
  });
}

test('scrypt acepta la clave exacta, rechaza otra y usa sal aleatoria', async () => {
  const verify = createPasswordVerifier(passwordHash);
  assert.equal(await verify(PASSWORD), true);
  assert.equal(await verify(`${PASSWORD} `), false);
  assert.notEqual(await hashPassword(PASSWORD), passwordHash);
});

test('configuracion invalida falla antes de registrar rutas', () => {
  for (const value of [undefined, '', 'texto-plano', 'scrypt$xx$yy']) {
    assert.throws(() => buildRoutes({ passwordHash: value }), /ADMIN_PASSWORD_HASH/);
  }
  assert.throws(() => buildRoutes({ requireCsrf: undefined }), /CSRF/);
});

test('login rechaza entradas invalidas sin modificar sesion', async () => {
  const login = buildRoutes().get('POST /api/admin/login');
  for (const body of [undefined, {}, { password: '' }, { password: 123 },
    { password: {} }, { password: 'a'.repeat(1025) }, { password: 'á'.repeat(513) }]) {
    const req = { body };
    const events = attachSession(req);
    assert.equal((await invoke(login, req)).code, 400);
    assert.deepEqual(events, []);
    assert.equal(req.session.isAdmin, undefined);
  }
});

test('clave incorrecta devuelve 401 y no crea autenticacion', async () => {
  const req = { body: { password: 'incorrecta' } };
  const events = attachSession(req);
  const res = await invoke(buildRoutes().get('POST /api/admin/login'), req);
  assert.equal(res.code, 401);
  assert.equal(req.session.isAdmin, undefined);
  assert.deepEqual(events, []);
});

test('login regenera y guarda; elimina datos/token de la sesion anterior', async () => {
  const req = { body: { password: PASSWORD } };
  const events = attachSession(req);
  req.session.csrfToken = 'token-viejo';
  const oldSession = req.session;
  const routes = buildRoutes();
  const res = await invoke(routes.get('POST /api/admin/login'), req);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body, { authenticated: true });
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.notEqual(req.session, oldSession);
  assert.equal(req.session.csrfToken, undefined);
  assert.equal(req.session.isAdmin, true);
  assert.deepEqual(events, ['regenerate', 'save']);
  assert.equal((await invoke(routes.get('GET /api/admin/session'), req)).code, 200);
});

test('fallos de regeneracion/guardado se delegan sin autenticar', async () => {
  for (const operation of ['regenerate', 'save']) {
    const error = new Error(`Fallo ${operation}`);
    const req = { body: { password: PASSWORD } };
    attachSession(req, { [operation]: error });
    await assert.rejects(invoke(buildRoutes().get('POST /api/admin/login'), req), error);
    assert.notEqual(req.session.isAdmin, true);
  }
});

test('requireAdmin exige booleano true y bloquea sesion ausente', async () => {
  for (const session of [undefined, {}, { isAdmin: false }, { isAdmin: 'true' }]) {
    assert.equal((await invoke([requireAdmin], { session })).code, 401);
  }
});

test('logout sin sesion o CSRF valido no destruye nada', async () => {
  const logout = buildRoutes().get('POST /api/admin/logout');
  assert.equal((await invoke(logout, {})).code, 401);
  for (const token of [undefined, 'alterado']) {
    const req = { headers: { 'x-csrf-token': token } };
    const events = attachSession(req);
    req.session.isAdmin = true;
    const res = await invoke(logout, req);
    assert.equal(res.code, 403);
    assert.deepEqual(events, []);
    assert.deepEqual(res.cleared, []);
  }
});

test('logout valido destruye sesion, borra cookie y revoca acceso', async () => {
  const req = { headers: { 'x-csrf-token': 'token-de-prueba' } };
  const events = attachSession(req);
  req.session.isAdmin = true;
  const routes = buildRoutes({ cookieName: 'minibuzon.sid' });
  const res = await invoke(routes.get('POST /api/admin/logout'), req);
  assert.deepEqual(res.body, { authenticated: false });
  assert.deepEqual(events, ['destroy']);
  assert.deepEqual(res.cleared, [['minibuzon.sid', {
    path: '/', domain: undefined, httpOnly: true, secure: false, sameSite: 'lax',
  }]]);
  assert.equal((await invoke(routes.get('GET /api/admin/session'), req)).code, 401);
});

test('fallo al destruir sesion no responde exito ni borra cookie', async () => {
  const error = new Error('Fallo destroy');
  const req = { headers: { 'x-csrf-token': 'token-de-prueba' } };
  attachSession(req, { destroy: error });
  req.session.isAdmin = true;
  await assert.rejects(invoke(buildRoutes().get('POST /api/admin/logout'), req), error);
});
