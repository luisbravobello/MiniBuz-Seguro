// TODO Junior: crearReporte, listarReportes, buscarReportes, obtenerReporte, eliminarReporte.
// REGLA: usar sentencias preparadas y parametros vinculados.
const db = require('./database.js');

function crearReporte(titulo, mensaje, imagen = null) {
    const query = db.prepare('INSERT INTO reportes (titulo, mensaje, imagen) VALUES (?, ?, ?)');
    const result = query.run(titulo, mensaje, imagen);
    return result.lastInsertRowid;
}

function listarReportes() {
    const query = db.prepare('SELECT id, titulo, mensaje, imagen, fecha FROM reportes ORDER BY id DESC');
    return query.all();
}

function buscarReportes(texto) {
    const textoEscapado = texto.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    const query = db.prepare(`SELECT id, titulo, mensaje, imagen, fecha FROM reportes WHERE titulo LIKE ? ESCAPE '\\' ORDER BY id DESC`);
    return query.all(`%${textoEscapado}%`);
}

function obtenerReporte(id) {
    const query = db.prepare('SELECT id, titulo, mensaje, imagen, fecha FROM reportes WHERE id = ?');
    return query.get(id);
}

function eliminarReporte(id) {
    const query = db.prepare('DELETE FROM reportes WHERE id = ?');
    const result = query.run(id);
    return result.changes;
}

module.exports = {
    crearReporte,
    listarReportes,
    buscarReportes,
    obtenerReporte,
    eliminarReporte
};