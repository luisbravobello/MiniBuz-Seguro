'use strict';

/**
 * database.js - Punto de entrada de la capa de datos (Albert, G3).
 *
 * Es una FACHADA: el resto del equipo solo usa este archivo. Los detalles
 * internos estan separados por responsabilidad (SOLID) en database/:
 *
 *   database/config.js              rutas y tiempos (sin logica)
 *   database/esquema.js             tabla reportes + aplicarEsquema()
 *   database/configuracionSqlite.js PRAGMAs de seguridad
 *   database/conexion.js            abrir, configurar y verificar una conexion
 *   database/respaldo.js            copia consistente con VACUUM INTO
 *
 * Este archivo mantiene la UNICA conexion del proceso (PDF de BD, 5.1).
 *
 * Uso (Junior, reportRepository.js):
 *   const { obtenerDb } = require('./database');
 *   const db = obtenerDb();
 *   db.prepare('SELECT ... WHERE id = ?').get(id);   // siempre con "?"
 *
 * Uso (Jorge, server.js):
 *   inicializarBaseDeDatos() al arrancar;
 *   cerrarBaseDeDatos() al recibir SIGINT/SIGTERM.
 *
 * REGLA: db.exec() solo con SQL fijo del codigo. Datos del usuario SIEMPRE
 * con db.prepare(...) y parametros vinculados.
 */

const config = require('./database/config');
const { abrirBaseDeDatos } = require('./database/conexion');
const respaldo = require('./database/respaldo');

let conexion = null;

/** Devuelve la conexion unica del proceso, creandola la primera vez. */
function obtenerDb() {
  if (conexion === null) {
    conexion = abrirBaseDeDatos(config.RUTA_BD);
  }
  return conexion;
}

/** Crea data/minibuzon.db y la tabla reportes al iniciar el servidor. */
function inicializarBaseDeDatos() {
  obtenerDb();
}

/** Crea un respaldo consistente en data/respaldos/ y devuelve su nombre. */
function crearRespaldo() {
  return respaldo.crearRespaldo(obtenerDb(), config.DIRECTORIO_RESPALDOS);
}

/** Cierra la conexion de forma ordenada (llamar al apagar el servidor). */
function cerrarBaseDeDatos() {
  if (conexion === null) return;
  const db = conexion;
  conexion = null;
  try {
    // Volcar el WAL al .db principal y dejar el -wal vacio.
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch { /* si falla, close() igual deja la BD consistente */ }
  db.close();
}

// Red de seguridad: si el proceso termina sin que server.js cierre la BD.
process.once('exit', () => {
  try { cerrarBaseDeDatos(); } catch { /* el proceso ya esta saliendo */ }
});

module.exports = {
  obtenerDb,
  inicializarBaseDeDatos,
  cerrarBaseDeDatos,
  crearRespaldo,
  abrirBaseDeDatos, // para pruebas con BD temporal
};
