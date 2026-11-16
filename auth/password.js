const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');

const deriveKey = promisify(scrypt);
// Parametros fijos: el hash almacenado no puede imponer un coste arbitrario.
const OPTIONS = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const HASH_FORMAT = /^scrypt\$([a-f0-9]{32})\$([a-f0-9]{128})$/;

function isValidPassword(password) {
  return typeof password === 'string'
    && Buffer.byteLength(password, 'utf8') > 0
    && Buffer.byteLength(password, 'utf8') <= 1024;
}

async function hashPassword(password) {
  if (!isValidPassword(password)) {
    throw new TypeError('La contrasena debe tener entre 1 y 1024 bytes.');
  }
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, 64, OPTIONS);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

function createPasswordVerifier(passwordHash) {
  const match = typeof passwordHash === 'string' && HASH_FORMAT.exec(passwordHash);
  if (!match) {
    throw new TypeError('ADMIN_PASSWORD_HASH ausente o invalido; generar con hashPassword.');
  }
  const salt = Buffer.from(match[1], 'hex');
  const expected = Buffer.from(match[2], 'hex');
  return async password => {
    if (!isValidPassword(password)) return false;
    const actual = await deriveKey(password, salt, expected.length, OPTIONS);
    return timingSafeEqual(actual, expected);
  };
}

module.exports = { hashPassword, createPasswordVerifier, isValidPassword };
