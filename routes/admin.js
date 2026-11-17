const express = require('express');
const path = require('node:path');
const fs = require('node:fs');

const repo = require('../reportRepository');
const { requireAdmin } = require('../auth');
const { validarCsrf } = require('../csrf');

const router = express.Router();
const carpetaImagenes = path.join(__dirname, '..', 'private-uploads');

function leerId(valor) {
  if (!/^\d+$/.test(valor)) return null;
  const id = Number(valor);
  if (!Number.isSafeInteger(id) || id < 1) return null;
  return id;
}

router.get('/reportes', requireAdmin, (req, res) => {
  let buscar = req.query.buscar;

  if (buscar !== undefined && typeof buscar !== 'string') {
    return res.status(400).json({ error: 'Busqueda no valida' });
  }

  buscar = (buscar || '').trim();
  if (buscar.length > 120) {
    return res.status(400).json({ error: 'La busqueda es muy larga' });
  }

  const filas = buscar ? repo.buscarReportes(buscar) : repo.listarReportes();

  const reportes = filas.map(r => ({
    id: r.id,
    titulo: r.titulo,
    mensaje: r.mensaje,
    fecha: r.fecha,
    tieneImagen: Boolean(r.imagen)
  }));

  res.json(reportes);
});

router.delete('/reportes/:id', requireAdmin, validarCsrf, (req, res) => {
  const id = leerId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID no valido' });

  const reporte = repo.obtenerReporte(id);
  if (!reporte) return res.status(404).json({ error: 'Reporte no encontrado' });

  repo.eliminarReporte(id);

  if (reporte.imagen) {
    const ruta = path.join(carpetaImagenes, path.basename(reporte.imagen));
    fs.unlink(ruta, err => {
      if (err && err.code !== 'ENOENT') {
        console.error('No se pudo borrar la imagen del reporte ' + id);
      }
    });
  }

  res.json({ ok: true });
});

router.get('/reportes/:id/imagen', requireAdmin, (req, res) => {
  const id = leerId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID no valido' });

  const reporte = repo.obtenerReporte(id);
  if (!reporte || !reporte.imagen) {
    return res.status(404).json({ error: 'Imagen no encontrada' });
  }

  const nombre = reporte.imagen;
  if (nombre !== path.basename(nombre) || !/\.(jpe?g|png)$/i.test(nombre)) {
    return res.status(404).json({ error: 'Imagen no encontrada' });
  }

  res.set('Cache-Control', 'no-store');
  res.sendFile(nombre, { root: carpetaImagenes, dotfiles: 'deny' }, err => {
    if (err && !res.headersSent) {
      res.status(404).json({ error: 'Imagen no encontrada' });
    }
  });
});

module.exports = router;
