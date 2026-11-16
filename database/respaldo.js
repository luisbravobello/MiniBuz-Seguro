'use strict';

/**
 * database/respaldo.js - Respaldo consistente de la BD (Albert, G3).
 *
 * SRP: SOLO genera copias de seguridad.
 *
 * PDF de BD 5.2: "detener escrituras y crear un backup consistente; no copiar
 * a ciegas con WAL activo". VACUUM INTO genera una copia completa y coherente
 * aunque WAL este activo.
 */

const fs = require('node:fs');
const path = require('node:path');

/**
 * @param {import('node:sqlite').DatabaseSync} db  conexion abierta
 * @param {string} directorio  carpeta destino (la define el servidor)
 * @returns {string} nombre del archivo creado (sin ruta)
 */
function crearRespaldo(db, directorio) {
  fs.mkdirSync(directorio, { recursive: true, mode: 0o700 });
  // El nombre lo genera el servidor con la fecha; nunca viene del cliente.
  const marca = new Date().toISOString().replace(/[:.]/g, '-');
  const nombre = `minibuzon-${marca}.db`;
  // La ruta destino se pasa como parametro vinculado, no concatenada.
  db.prepare('VACUUM INTO ?;').run(path.join(directorio, nombre));
  return nombre;
}

module.exports = { crearRespaldo };
