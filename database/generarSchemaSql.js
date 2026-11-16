'use strict';

/**
 * database/generarSchemaSql.js - Regenera database/schema.sql (Albert, G3).
 *
 * Uso:  node database/generarSchemaSql.js
 *
 * schema.sql es una copia de REFERENCIA, totalmente comentada, del esquema
 * real (database/esquema.js). Asi la documentacion nunca queda desfasada y
 * Visual Studio no la analiza como T-SQL.
 */

const fs = require('node:fs');
const path = require('node:path');
const { ESQUEMA_SQL, VERSION_ESQUEMA } = require('./esquema');

const encabezado = [
  '=====================================================================',
  'MiniBuzon Seguro - Esquema SQLite de REFERENCIA (responsable: Albert, G3)',
  `Version del esquema: ${VERSION_ESQUEMA}`,
  '',
  'El esquema EJECUTABLE esta en database/esquema.js (constante ESQUEMA_SQL)',
  'y lo aplica database.js al iniciar, como indica el PDF de BD.',
  '',
  'Este archivo esta totalmente comentado a proposito: Visual Studio analiza',
  'los .sql como SQL Server (T-SQL) y marca como error la sintaxis valida de',
  'SQLite (IF NOT EXISTS, STRICT, GLOB...). No editar a mano; regenerar con:',
  '    node database/generarSchemaSql.js',
  '=====================================================================',
  '',
];

const cuerpo = ESQUEMA_SQL.trim().split('\n');
const contenido = [...encabezado, ...cuerpo]
  .map((linea) => `-- ${linea}`.trimEnd())
  .join('\n') + '\n';

fs.writeFileSync(path.join(__dirname, 'schema.sql'), contenido, 'utf8');
console.log('database/schema.sql regenerado');
