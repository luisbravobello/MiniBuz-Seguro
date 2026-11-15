'use strict';

/**
 * database/config.js - Configuracion de la capa de datos (Albert, G3).
 *
 * SRP: este modulo SOLO define valores de configuracion; no abre conexiones.
 * Todas las rutas se calculan en el servidor a partir de la raiz del
 * proyecto. Ningun dato del cliente participa en ellas.
 *
 * La BD no guarda secretos (la contrasena del admin vive en .env como hash),
 * por eso estas rutas no necesitan variables de entorno.
 */

const path = require('node:path');

const RAIZ_PROYECTO = path.join(__dirname, '..');
const DIRECTORIO_DATOS = path.join(RAIZ_PROYECTO, 'data');

module.exports = Object.freeze({
  // data/ esta fuera de public/: express.static nunca puede entregar el .db.
  // .gitignore excluye data/*, *.db, *.db-wal y *.db-shm.
  DIRECTORIO_DATOS,
  RUTA_BD: path.join(DIRECTORIO_DATOS, 'minibuzon.db'),
  DIRECTORIO_RESPALDOS: path.join(DIRECTORIO_DATOS, 'respaldos'),

  // Carpeta servida al navegador: la BD nunca puede quedar dentro.
  DIRECTORIO_PUBLICO: path.join(RAIZ_PROYECTO, 'public'),

  // Tiempo maximo (ms) que una escritura espera ante un bloqueo antes de
  // fallar con SQLITE_BUSY.
  TIEMPO_ESPERA_BLOQUEO_MS: 5000,

  // Ruta especial de SQLite para una BD temporal en memoria (pruebas).
  RUTA_MEMORIA: ':memory:',
});
