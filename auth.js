const { createPasswordVerifier, isValidPassword } = require('./auth/password');

function requireAdmin(req, res, next) {
  res.set('Cache-Control', 'no-store');
  if (req.session?.isAdmin !== true) {
    return res.status(401).json({ error: 'Se requiere una sesion administrativa.' });
  }
  next();
}

// Llamar despues de express.json() y express-session, pasando el CSRF de G4.
function registerAuthRoutes(app, {
  passwordHash = process.env.ADMIN_PASSWORD_HASH,
  requireCsrf,
  cookieName = 'connect.sid',
} = {}) {
  if (typeof requireCsrf !== 'function') {
    throw new TypeError('Se requiere el middleware CSRF para registrar logout.');
  }
  const verifyPassword = createPasswordVerifier(passwordHash);

  app.post('/api/admin/login', async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const password = req.body?.password;
    if (!isValidPassword(password)) {
      return res.status(400).json({ error: 'Contrasena requerida (maximo 1024 bytes).' });
    }
    try {
      if (!await verifyPassword(password)) {
        return res.status(401).json({ error: 'Credenciales incorrectas.' });
      }
      // Regenerar descarta el ID anterior y cualquier token CSRF anterior.
      await new Promise((resolve, reject) => {
        req.session.regenerate(error => error ? reject(error) : resolve());
      });
      req.session.isAdmin = true;
      try {
        await new Promise((resolve, reject) => {
          req.session.save(error => error ? reject(error) : resolve());
        });
      } catch (error) {
        delete req.session.isAdmin;
        throw error;
      }
      return res.status(200).json({ authenticated: true });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/session', requireAdmin, (req, res) => {
    res.status(200).json({ authenticated: true });
  });

  app.post('/api/admin/logout', requireAdmin, requireCsrf, (req, res, next) => {
    const { path, domain, httpOnly, secure, sameSite } = req.session.cookie;
    req.session.destroy(error => {
      if (error) return next(error);
      res.clearCookie(cookieName, { path, domain, httpOnly, secure, sameSite });
      res.status(200).json({ authenticated: false });
    });
  });
}

module.exports = { registerAuthRoutes, requireAdmin };
