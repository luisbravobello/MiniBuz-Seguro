'use strict';

/**
 * database/esquema.js - Definicion de la tabla reportes (Albert, G3).
 *
 * SRP: este modulo SOLO describe la estructura de datos.
 * Fuente: docs/MiniBuzonSeguro_Base_de_Datos.pdf, secciones 1 y 2.
 *
 * Reglas de diseno (PDF 1.1):
 *   - Una unica tabla de negocio: reportes. Sin usuarios, sesiones ni roles.
 *   - La contrasena del administrador NO vive en SQLite (hash en .env).
 *   - La imagen NO se guarda como binario: solo el nombre interno aleatorio
 *     generado por uploads.js; nunca una ruta.
 *
 * ESQUEMA_SQL es texto FIJO (sin variables ni datos del usuario), por eso es
 * seguro ejecutarlo con db.exec(). database/schema.sql guarda una copia
 * comentada de referencia, para que Visual Studio no lo analice como T-SQL.
 *
 * OCP: si el esquema cambia en el futuro, se sube VERSION_ESQUEMA y se agrega
 * una migracion; no hay que modificar conexion.js.
 */

const VERSION_ESQUEMA = 1;

const ESQUEMA_SQL = `
CREATE TABLE IF NOT EXISTS reportes (
    -- Identificador generado por SQLite. AUTOINCREMENT evita que se
    -- reutilice el id de un reporte borrado. El cliente nunca lo envia.
    id      INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Obligatorio; 1-120 caracteres reales despues de quitar espacios.
    titulo  TEXT NOT NULL
            CHECK (length(trim(titulo)) BETWEEN 1 AND 120
                   AND length(titulo) <= 120),

    -- Obligatorio; 1-2000 caracteres reales despues de quitar espacios.
    mensaje TEXT NOT NULL
            CHECK (length(trim(mensaje)) BETWEEN 1 AND 2000
                   AND length(mensaje) <= 2000),

    -- Opcional (NULL = sin adjunto). Solo un nombre de archivo plano:
    --   - caracteres permitidos: letras, digitos, punto, guion y guion bajo
    --     (impide '/', '\\', ':' y por tanto rutas absolutas o relativas)
    --   - sin '..' ni nombre oculto que empiece con '.'
    --   - extension final .jpg, .jpeg o .png
    imagen  TEXT
            CHECK (imagen IS NULL OR (
                       length(imagen) BETWEEN 5 AND 100
                   AND imagen NOT GLOB '*[^0-9A-Za-z._-]*'
                   AND imagen NOT GLOB '.*'
                   AND instr(imagen, '..') = 0
                   AND (   lower(imagen) GLOB '*.jpg'
                        OR lower(imagen) GLOB '*.jpeg'
                        OR lower(imagen) GLOB '*.png'))),

    -- Fecha UTC asignada por SQLite al insertar ('AAAA-MM-DD HH:MM:SS').
    -- El formulario no la decide; el CHECK impide formatos arbitrarios.
    fecha   TEXT NOT NULL DEFAULT (datetime('now'))
            CHECK (fecha GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9] [0-2][0-9]:[0-5][0-9]:[0-5][0-9]')
) STRICT;
-- STRICT: SQLite rechaza valores de tipo incorrecto (p. ej. un BLOB o un
-- numero en titulo) en lugar de convertirlos silenciosamente.

-- Un archivo de imagen pertenece a un solo reporte. Evita que borrar un
-- reporte elimine la imagen de otro. Indice parcial: no afecta a NULL.
CREATE UNIQUE INDEX IF NOT EXISTS ux_reportes_imagen
    ON reportes (imagen)
    WHERE imagen IS NOT NULL;

-- Nota sobre indices: el panel ordena por id DESC (usa la PRIMARY KEY) y la
-- busqueda usa LIKE '%texto%', que no puede aprovechar un indice B-tree.
-- Con el volumen de una demo local no se crean indices adicionales.
`;

/**
 * Crea la tabla si no existe (idempotente) dentro de una transaccion:
 * o se aplica todo o nada. Registra la version en PRAGMA user_version.
 * @param {import('node:sqlite').DatabaseSync} db
 */
function aplicarEsquema(db) {
  db.exec('BEGIN IMMEDIATE;');
  try {
    db.exec(ESQUEMA_SQL);
    // VERSION_ESQUEMA es una constante entera del codigo, no un dato externo
    // (PRAGMA no admite parametros "?"; se valida que sea un entero real).
    if (!Number.isSafeInteger(VERSION_ESQUEMA)) throw new TypeError('VERSION_ESQUEMA invalida');
    db.exec(`PRAGMA user_version = ${VERSION_ESQUEMA};`);
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

module.exports = { ESQUEMA_SQL, VERSION_ESQUEMA, aplicarEsquema };
