'use strict';

/**
 * MiniBuzon Seguro - servidor e integracion (G5, Jorge).
 * Base de trabajo: rama develop de luisbravobello/MiniBuz-Seguro.
 *
 * Responsabilidades: Express, cabeceras, sesiones, rutas, frontend, BD,
 * errores seguros y apagado limpio. NO implementa el trabajo de otras parejas.
 */

const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');

const { inicializarBaseDeDatos, cerrarBaseDeDatos } = require('./database');
const { registerAuthRoutes, requireAdmin } = require('./auth');
const csrf = require('./csrf');

const PUERTO = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const SECRETO_SESION = process.env.SESSION_SECRET;
const NOMBRE_COOKIE = 'minibuzon.sid';

// No iniciar un servidor administrativo con credenciales predeterminadas.
if (!Number.isInteger(PUERTO) || PUERTO < 1 || PUERTO > 65535) {
  throw new Error('PORT debe ser un puerto valido entre 1 y 65535.');
}
if (typeof SECRETO_SESION !== 'string' || Buffer.byteLength(SECRETO_SESION, 'utf8') < 32) {
  throw new Error('SESSION_SECRET debe tener al menos 32 bytes aleatorios.');
}
if (!process.env.ADMIN_PASSWORD_HASH) {
  throw new Error('Falta ADMIN_PASSWORD_HASH en .env; no se usan claves por defecto.');
}

// En esta demo se accede por HTTP desde localhost o desde una LAN de pruebas.
// NO desplegar con HTTP ni cookies secure:false en Internet.
const app = express();
app.disable('x-powered-by');

app.use(helmet({
  // Safari puede intentar convertir localhost HTTP en HTTPS si esta directiva
  // se incluye. En la demo local no hay HTTPS configurado.
  contentSecurityPolicy: {
    directives: {
      'upgrade-insecure-requests': null,
    },
  },
  // No enviar HSTS sobre un servicio local HTTP.
  strictTransportSecurity: false,
}));

// JSON para login y formularios no-multipart. Los adjuntos los procesa G1/G5.
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: false, limit: '16kb' }));

// Una sesion administrativa guardada en el servidor; MemoryStore es solo demo.
app.use(session({
  name: NOMBRE_COOKIE,
  secret: SECRETO_SESION,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // LAN / localhost HTTP solamente.
    path: '/',
    maxAge: 2 * 60 * 60 * 1000,
  },
}));

// El equipo G4 registra login/session/logout; este middleware protege logout.
registerAuthRoutes(app, {
  passwordHash: process.env.ADMIN_PASSWORD_HASH,
  requireCsrf: csrf.validarCsrf,
  cookieName: NOMBRE_COOKIE,
});

// Luis: emitir un token por sesion, solo despues de comprobar admin.
app.get('/api/admin/csrf', requireAdmin, csrf.emitirToken);

/**
 * Adaptador TEMPORAL de integracion: John usa verificarCsrf, pero Luis
 * exporta validarCsrf. No cambia la comprobacion: es la misma funcion.
 * John debe corregir su import en routes/admin.js y despues quitar esto.
 */
if (typeof csrf.verificarCsrf !== 'function' && typeof csrf.validarCsrf === 'function') {
  csrf.verificarCsrf = csrf.validarCsrf;
}

// Rutas de G1: reportes publicos y operaciones privadas de administracion.
app.use('/api/reportes', require('./routes/reportes'));
app.use('/api/admin', require('./routes/admin'));

// Ninguna carpeta sensible (data, database, private-uploads, auth, etc.)
// se publica: solamente se sirve lo que esta dentro de public/.
app.use(express.static(path.join(__dirname, 'public'), {
  dotfiles: 'deny',
  index: 'index.html',
  fallthrough: true,
}));

// Comprobacion sencilla de disponibilidad: no revela claves ni rutas locales.
app.get('/health', (req, res) => res.json({ ok: true }));

// 404 coherente para todas las peticiones no reconocidas.
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Ruta no encontrada.' });
  }
  return res.status(404).type('text').send('Pagina no encontrada.');
});

// Manejador central: nunca enviar trazas, rutas internas ni secretos al cliente.
// Express 5 tambien propaga errores de handlers async a este middleware.
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (res.headersSent) return next(err);
  const estado = err.statusCode || err.status;
  if (err.type === 'entity.too.large' || estado === 413) {
    return res.status(413).json({ error: 'Los datos superan el tamano permitido.' });
  }
  if (err.type === 'entity.parse.failed' || estado === 400) {
    return res.status(400).json({ error: 'Solicitud invalida.' });
  }
  console.error('[MiniBuzon] Error interno:', err);
  return res.status(500).json({ error: 'Error interno del servidor.' });
});

function iniciarServidor() {
  // Abortamos antes de escuchar si SQLite no puede abrirse/crearse.
  inicializarBaseDeDatos();

  const servidor = app.listen(PUERTO, HOST, () => {
    console.log(`[MiniBuzon] Disponible en http://localhost:${PUERTO}`);
    if (HOST === '0.0.0.0') {
      console.log('[MiniBuzon] Para otros equipos usa http://<IP_LOCAL>:' + PUERTO);
    }
  });

  servidor.on('error', (error) => {
    console.error('[MiniBuzon] No se pudo abrir el servidor:', error.message);
    try { cerrarBaseDeDatos(); } catch (e) { console.error(e); }
    process.exitCode = 1;
  });

  let cerrando = false;
  function terminar(senal) {
    if (cerrando) return;
    cerrando = true;
    console.log(`[MiniBuzon] Apagando por ${senal}...`);
    servidor.close((error) => {
      try { cerrarBaseDeDatos(); } catch (e) { console.error(e); process.exitCode = 1; }
      if (error) {
        console.error(error);
        process.exitCode = 1;
      }
    });
  }
  process.once('SIGINT', () => terminar('SIGINT'));
  process.once('SIGTERM', () => terminar('SIGTERM'));
  return servidor;
}

if (require.main === module) {
  iniciarServidor();
}

module.exports = { app, iniciarServidor };
