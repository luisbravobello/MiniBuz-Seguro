'use strict';

/**
 * database/configuracionSqlite.js - Endurecimiento de SQLite (Albert, G3).
 *
 * SRP: este modulo SOLO aplica la configuracion segura (PRAGMAs) a una
 * conexion ya abierta. No abre conexiones ni crea tablas.
 */

/**
 * @param {import('node:sqlite').DatabaseSync} db  conexion recien abierta
 * @param {{ esMemoria: boolean, tiempoEsperaMs: number }} opciones
 */
function aplicarConfiguracionSegura(db, { esMemoria, tiempoEsperaMs }) {
  // Validacion estricta: solo un numero entero real (nunca texto), porque el
  // valor se escribe dentro de un PRAGMA, que no admite parametros "?".
  if (!Number.isSafeInteger(tiempoEsperaMs) || tiempoEsperaMs < 0) {
    throw new TypeError('tiempoEsperaMs debe ser un entero positivo');
  }
  const espera = tiempoEsperaMs;

  // busy_timeout: esperar en vez de fallar ante bloqueos breves.
  db.exec(`PRAGMA busy_timeout = ${espera};`);

  // Claves foraneas activas (SQLite las trae apagadas por defecto). Hoy hay
  // una sola tabla, pero queda garantizado si el esquema crece.
  db.exec('PRAGMA foreign_keys = ON;');

  // No confiar en funciones o vistas definidas dentro del propio archivo .db
  // (mitiga un archivo de BD manipulado).
  db.exec('PRAGMA trusted_schema = OFF;');

  // Sobrescribir con ceros el contenido borrado: un reporte eliminado no
  // queda recuperable leyendo el archivo .db.
  db.exec('PRAGMA secure_delete = ON;');

  // Modo defensivo si la version de Node lo ofrece (impide que SQL corrompa
  // el archivo a proposito, p. ej. con PRAGMA writable_schema).
  if (typeof db.enableDefensive === 'function') {
    db.enableDefensive(true);
  }

  if (!esMemoria) {
    // WAL: los lectores (panel admin) no bloquean al escritor (formulario
    // publico) cuando varios navegadores de la LAN usan la app a la vez.
    // Requiere disco local: no ubicar la BD en una carpeta de red.
    db.exec('PRAGMA journal_mode = WAL;');
    // NORMAL es seguro con WAL y evita un fsync por cada transaccion.
    db.exec('PRAGMA synchronous = NORMAL;');
  }
}

module.exports = { aplicarConfiguracionSegura };
