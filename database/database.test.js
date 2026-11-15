'use strict';

// Pruebas de la capa de datos (PDF de BD, seccion 6 "Plan de pruebas").
// Ejecutar desde la raiz del proyecto:   node --test database/
// Usan una BD temporal: NO tocan data/minibuzon.db.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { abrirBaseDeDatos } = require('../database');
const { VERSION_ESQUEMA } = require('./esquema');
const { aplicarConfiguracionSegura } = require('./configuracionSqlite');
const { crearRespaldo } = require('./respaldo');
const { DatabaseSync } = require('node:sqlite');

const dirTemporal = fs.mkdtempSync(path.join(os.tmpdir(), 'minibuzon-test-'));
const db = abrirBaseDeDatos(path.join(dirTemporal, 'prueba.db'));

// Las mismas formas de SQL que usara reportRepository.js (siempre con "?").
const insertar = db.prepare('INSERT INTO reportes (titulo, mensaje, imagen) VALUES (?, ?, ?)');
const porId = db.prepare('SELECT id, titulo, mensaje, imagen, fecha FROM reportes WHERE id = ?');
const buscar = db.prepare(
  "SELECT id, titulo, mensaje, imagen, fecha FROM reportes WHERE titulo LIKE ? ESCAPE '\\' ORDER BY id DESC"
);
const eliminar = db.prepare('DELETE FROM reportes WHERE id = ?');
const contar = db.prepare('SELECT count(*) AS n FROM reportes');

// Busqueda literal: escapar \, % y _ antes de rodear con %.
const patronLiteral = (texto) => `%${texto.replace(/[\\%_]/g, (c) => '\\' + c)}%`;

test.after(() => {
  db.close();
  fs.rmSync(dirTemporal, { recursive: true, force: true });
});

test('configuracion segura de SQLite aplicada', () => {
  assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
  assert.equal(db.prepare('PRAGMA journal_mode').get().journal_mode, 'wal');
  assert.equal(db.prepare('PRAGMA busy_timeout').get().timeout, 5000);
  assert.equal(db.prepare('PRAGMA trusted_schema').get().trusted_schema, 0);
  assert.equal(db.prepare('PRAGMA secure_delete').get().secure_delete, 1);
});

test('esquema idempotente: abrir dos veces no falla ni duplica', () => {
  const ruta = path.join(dirTemporal, 'idem.db');
  abrirBaseDeDatos(ruta).close();
  const otra = abrirBaseDeDatos(ruta);
  const tablas = otra.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
  ).all().map((t) => t.name);
  otra.close();
  assert.deepEqual(tablas, ['reportes']);
});

test('insertar valido: devuelve id y fecha automatica UTC', () => {
  const r = insertar.run('Problema con PC', 'Equipo no enciende', null);
  const fila = porId.get(r.lastInsertRowid);
  assert.ok(fila.id > 0);
  assert.match(fila.fecha, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
});

test('titulo vacio o solo espacios se rechaza por CHECK', () => {
  assert.throws(() => insertar.run('', 'mensaje', null), /CHECK/);
  assert.throws(() => insertar.run('     ', 'mensaje', null), /CHECK/);
});

test('titulo/mensaje NULL se rechaza por NOT NULL', () => {
  assert.throws(() => insertar.run(null, 'mensaje', null), /NOT NULL/);
  assert.throws(() => insertar.run('titulo', null, null), /NOT NULL/);
});

test('limites de longitud: 120 y 2000 aceptados, 121 y 2001 rechazados', () => {
  assert.doesNotThrow(() => insertar.run('t'.repeat(120), 'm'.repeat(2000), null));
  assert.throws(() => insertar.run('t'.repeat(121), 'mensaje', null), /CHECK/);
  assert.throws(() => insertar.run('titulo', 'm'.repeat(2001), null), /CHECK/);
});

test('STRICT: tipos incorrectos se rechazan', () => {
  assert.throws(() => insertar.run(Buffer.from('bin'), 'mensaje', null));
  assert.throws(() => insertar.run('titulo', 'mensaje', Buffer.from([0x89, 0x50])));
});

test('sin imagen: reporte almacenado normalmente', () => {
  const r = insertar.run('Sin adjunto', 'Mensaje', null);
  assert.equal(porId.get(r.lastInsertRowid).imagen, null);
});

test('imagen: acepta nombre interno aleatorio jpg/png', () => {
  assert.doesNotThrow(() => insertar.run('Con foto', 'M', '9fa3c1e2b4d5a6f7.png'));
  assert.doesNotThrow(() => insertar.run('Con foto', 'M', '3b1f0c2e-6a7d-4e8f-9a0b-1c2d3e4f5a6b.jpg'));
});

test('imagen: rechaza rutas, traversal y extensiones no permitidas', () => {
  const invalidos = [
    '../server.js', '..\\..\\x.png', '/etc/passwd.png', 'C:\\x\\a.png',
    'carpeta/a.png', '.oculto.png', 'a..png', 'shell.php', 'foto.png.exe',
    'foto.gif', 'con espacio.png', 'x.png%00.js', '',
  ];
  for (const nombre of invalidos) {
    assert.throws(() => insertar.run('t', 'm', nombre), /CHECK/, `deberia rechazar: ${nombre}`);
  }
});

test('imagen: el mismo archivo no puede pertenecer a dos reportes', () => {
  insertar.run('A', 'm', 'unico0001.jpg');
  assert.throws(() => insertar.run('B', 'm', 'unico0001.jpg'), /UNIQUE/);
});

test('busqueda literal con comillas y simbolos no cambia la estructura', () => {
  insertar.run("O'Reilly 100% _x_ \"cita\"", 'm', null);
  insertar.run('Otro 100 x', 'm', null);
  const res = buscar.all(patronLiteral('100%'));
  assert.equal(res.length, 1);
  assert.equal(res[0].titulo, "O'Reilly 100% _x_ \"cita\"");
  assert.equal(buscar.all(patronLiteral("O'Reilly")).length, 1);
});

test('SQL Injection como texto de busqueda: no devuelve datos ni ejecuta SQL', () => {
  const antes = contar.get().n;
  const ataques = [
    "' OR '1'='1",
    "' OR 1=1 --",
    "%' UNION SELECT name, sql, null, null, null FROM sqlite_master --",
    "'; DROP TABLE reportes; --",
  ];
  for (const ataque of ataques) {
    assert.deepEqual(buscar.all(patronLiteral(ataque)), [], ataque);
  }
  assert.equal(contar.get().n, antes, 'la tabla sigue intacta');
});

test('una sentencia preparada ejecuta solo UNA instruccion (no apila SQL)', () => {
  // prepare() compila unicamente la primera sentencia; el resto se descarta.
  const filas = db.prepare('SELECT 1 AS uno; DROP TABLE reportes;').all();
  assert.deepEqual(filas.map((f) => ({ ...f })), [{ uno: 1 }]);
  assert.ok(contar.get().n > 0, 'la tabla reportes sigue existiendo');
});

test('obtener inexistente devuelve undefined; borrar inexistente afecta 0 filas', () => {
  assert.equal(porId.get(999999), undefined);
  assert.equal(eliminar.run(999999).changes, 0);
});

test('borrar existente afecta 1 fila y el id no se reutiliza', () => {
  const { lastInsertRowid: id } = insertar.run('Borrar', 'm', null);
  assert.equal(eliminar.run(id).changes, 1);
  const { lastInsertRowid: nuevo } = insertar.run('Nuevo', 'm', null);
  assert.ok(nuevo > id);
});

test('la extension de carga de librerias esta deshabilitada', () => {
  assert.throws(() => db.loadExtension('malicioso'));
});

test('la BD no puede ubicarse dentro de public/', () => {
  const dentro = path.join(__dirname, '..', 'public', 'x.db');
  assert.throws(() => abrirBaseDeDatos(dentro), /public/);
});

// ---- Pruebas de los modulos separados (SOLID) ----

test('esquema: registra la version en PRAGMA user_version', () => {
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, VERSION_ESQUEMA);
});

test('configuracionSqlite: rechaza un tiempo de espera invalido', () => {
  const memoria = new DatabaseSync(':memory:');
  assert.throws(() => aplicarConfiguracionSegura(memoria, { esMemoria: true, tiempoEsperaMs: '5; DROP' }), TypeError);
  memoria.close();
});

test('conexion (DIP): un fallo al configurar da error generico sin rutas', () => {
  const ruta = path.join(dirTemporal, 'falla.db');
  const fallar = () => { throw new Error(`detalle interno en ${ruta}`); };
  assert.throws(
    () => abrirBaseDeDatos(ruta, { configurar: fallar }),
    (err) => err.message === 'No se pudo inicializar la base de datos' && !err.message.includes(dirTemporal)
  );
});

test('conexion: funciona en memoria para pruebas rapidas', () => {
  const memoria = abrirBaseDeDatos(':memory:');
  assert.equal(memoria.prepare('INSERT INTO reportes (titulo, mensaje) VALUES (?, ?)').run('a', 'b').changes, 1);
  memoria.close();
});

test('respaldo: crea una copia consistente y legible', () => {
  const destino = path.join(dirTemporal, 'respaldos');
  const nombre = crearRespaldo(db, destino);
  assert.match(nombre, /^minibuzon-[0-9TZ-]+\.db$/);
  const copia = new DatabaseSync(path.join(destino, nombre), { readOnly: true });
  assert.equal(copia.prepare('SELECT count(*) AS n FROM reportes').get().n, contar.get().n);
  copia.close();
});
