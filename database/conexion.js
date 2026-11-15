'use strict';

/**
 * database/conexion.js - Fabrica de conexiones SQLite (Albert, G3).
 *
 * SRP: abre UNA conexion, la configura, aplica el esquema y verifica su
 *      integridad. No guarda estado global (eso lo hace database.js).
 * DIP: recibe por parametro la configuracion y el esquema que aplica, con
 *      valores por defecto. Las pruebas pueden inyectar otra ruta u otro
 *      esquema sin modificar este archivo.
 */

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const config = require('./config');
const { aplicarConfiguracionSegura } = require('./configuracionSqlite');
const { aplicarEsquema } = require('./esquema');

/** Lanza un error si la ruta queda dentro de la carpeta publica. */
function asegurarFueraDePublic(ruta, directorioPublico) {
  const relativa = path.relative(directorioPublico, path.resolve(ruta));
  const estaDentro = relativa === '' ||
    (!relativa.startsWith('..') && !path.isAbsolute(relativa));
  if (estaDentro) {
    throw new Error('La base de datos no puede ubicarse dentro de public/');
  }
}

/** Ejecuta PRAGMA quick_check y lanza un error si el archivo esta danado. */
function verificarIntegridad(db) {
  const { quick_check: estado } = db.prepare('PRAGMA quick_check;').get();
  if (estado !== 'ok') {
    throw new Error('La base de datos no supero la verificacion de integridad');
  }
}

/**
 * Abre (o crea) una base de datos configurada y con el esquema aplicado.
 *
 * @param {string} [ruta]  archivo .db o ':memory:'
 * @param {object} [dependencias]  para inyectar en pruebas
 * @returns {import('node:sqlite').DatabaseSync}
 */
function abrirBaseDeDatos(ruta = config.RUTA_BD, {
  configurar = aplicarConfiguracionSegura,
  crearEsquema = aplicarEsquema,
  tiempoEsperaMs = config.TIEMPO_ESPERA_BLOQUEO_MS,
  directorioPublico = config.DIRECTORIO_PUBLICO,
} = {}) {
  const esMemoria = ruta === config.RUTA_MEMORIA;

  if (!esMemoria) {
    asegurarFueraDePublic(ruta, directorioPublico);
    // 0o700: solo el usuario que ejecuta Node puede entrar (en Windows el
    // modo se ignora y aplican los permisos NTFS de la carpeta del usuario).
    fs.mkdirSync(path.dirname(ruta), { recursive: true, mode: 0o700 });
  }

  const db = new DatabaseSync(ruta, {
    enableForeignKeyConstraints: true,
    // Comillas dobles = identificadores, nunca cadenas (evita SQL ambiguo).
    enableDoubleQuotedStringLiterals: false,
    // Prohibir cargar extensiones nativas desde SQL.
    allowExtension: false,
    timeout: tiempoEsperaMs,
  });

  try {
    configurar(db, { esMemoria, tiempoEsperaMs });
    crearEsquema(db);
    verificarIntegridad(db);

    if (!esMemoria) {
      // Permisos restrictivos para el archivo (efectivo en Linux/macOS).
      try { fs.chmodSync(ruta, 0o600); } catch { /* Windows: sin efecto */ }
    }
    return db;
  } catch (err) {
    try { db.close(); } catch { /* ya cerrada */ }
    // Mensaje generico: no exponer rutas internas si llegara al cliente.
    throw new Error('No se pudo inicializar la base de datos', { cause: err });
  }
}

module.exports = { abrirBaseDeDatos, asegurarFueraDePublic };
