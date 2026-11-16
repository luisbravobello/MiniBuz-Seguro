'use strict';

// csrf.js - Luis (G4)
// Proteccion CSRF con token sincronizador ligado a la sesion.
//
// Como se usa (lo monta Jorge en server.js y lo usa routes/admin.js):
//
//   const { emitirToken, validarCsrf } = require('./csrf');
//
//   router.get('/csrf',   requireAdmin, emitirToken);              // GET  /api/admin/csrf
//   router.post('/logout', requireAdmin, validarCsrf, logout);     // POST /api/admin/logout
//   router.delete('/reportes/:id', requireAdmin, validarCsrf, ...) // DELETE
//
// ORDEN OBLIGATORIO: primero la sesion de administrador (401) y despues el
// token CSRF (403). Asi "eliminar sin login" devuelve 401 y "eliminar sin
// token" devuelve 403, como pide la lista de comprobacion.
//
// Requisito con auth.js (Angel): regenerar la sesion al hacer login
// (req.session.regenerate). Como el token vive dentro de la sesion, un login
// nuevo obtiene un token nuevo, y al destruir la sesion en logout el token
// deja de existir.

const crypto = require('node:crypto');

const CABECERA = 'x-csrf-token';
const CLAVE_SESION = 'csrfToken';
const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Respuesta unica para cualquier fallo: no dice si faltaba el token, si estaba
// alterado o si el origen no coincidia.
function rechazar(res) {
  return res.status(403).json({ error: 'Solicitud no permitida.' });
}

// Devuelve el token de la sesion; lo crea la primera vez.
// 32 bytes aleatorios del sistema (256 bits), en hexadecimal.
function generarToken(req) {
  if (!req.session) {
    throw new Error('csrf: falta express-session antes de csrf.js');
  }
  if (typeof req.session[CLAVE_SESION] !== 'string') {
    req.session[CLAVE_SESION] = crypto.randomBytes(32).toString('hex');
  }
  return req.session[CLAVE_SESION];
}

// Comparacion en tiempo constante. timingSafeEqual exige buffers de la misma
// longitud, asi que se comparan los SHA-256 de ambos valores (siempre 32 bytes).
function tokensIguales(esperado, recibido) {
  if (typeof esperado !== 'string' || typeof recibido !== 'string') return false;
  const a = crypto.createHash('sha256').update(esperado).digest();
  const b = crypto.createHash('sha256').update(recibido).digest();
  return crypto.timingSafeEqual(a, b);
}

// Complemento al token: si el navegador manda Origin, su host debe ser el
// mismo al que se hizo la peticion. Funciona igual en localhost y por IP de LAN.
// Si no hay Origin (curl, algunas peticiones del mismo origen) no se bloquea;
// la defensa principal sigue siendo el token.
function origenPermitido(req) {
  const origen = req.get('origin');
  if (origen === undefined) return true;
  try {
    return new URL(origen).host === req.get('host');
  } catch {
    return false;
  }
}

// GET /api/admin/csrf  (detras de requireAdmin)
function emitirToken(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json({ csrfToken: generarToken(req) });
}

// Middleware para acciones que cambian datos. Los metodos de solo lectura pasan.
function validarCsrf(req, res, next) {
  if (METODOS_SEGUROS.has(req.method)) return next();

  if (!origenPermitido(req)) return rechazar(res);

  const esperado = req.session && req.session[CLAVE_SESION];
  const recibido = req.get(CABECERA);
  if (!tokensIguales(esperado, recibido)) return rechazar(res);

  return next();
}

module.exports = { generarToken, emitirToken, validarCsrf, origenPermitido };
