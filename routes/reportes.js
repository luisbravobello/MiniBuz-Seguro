const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');
const { procesarImagen, UPLOADS_DIR } = require('../uploads');
const { crearReporte } = require('../reportRepository');

const router = express.Router();


// Funcion para revisar titulo y mensaje.
//    Devuelve el texto sin espacios sobrantes, o null si no es valido.
function validarTexto(texto, maximo) {
  if (typeof texto !== 'string') {
    return null;
  }
  const limpio = texto.trim();
  if (limpio.length < 1 || limpio.length > maximo) {
    return null;
  }
  return limpio;
}


async function eliminarImagenHuerfana(nombreImagen) {
  if (!nombreImagen) return;
  try {
    await fs.unlink(path.join(UPLOADS_DIR, nombreImagen));
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('No se pudo borrar la imagen huerfana');
  }
}

// procesarImagen es el unico middleware que recibe y normaliza el adjunto.
router.post('/', procesarImagen, async (req, res, next) => {
  const datos = req.body || {};
  const titulo = validarTexto(datos.titulo, 120);
  const mensaje = validarTexto(datos.mensaje, 2000);
  const nombreImagen = req.imagen ? req.imagen.nombreArchivo : null;

  if (titulo === null || mensaje === null) {
    await eliminarImagenHuerfana(nombreImagen);
    return res.status(400).json({
      error: 'El titulo debe tener de 1 a 120 caracteres y el mensaje de 1 a 2000.',
    });
  }

  try {
    const id = crearReporte(titulo, mensaje, nombreImagen);
    return res.status(201).json({ id: Number(id), mensaje: 'Reporte enviado.' });
  } catch (error) {
    await eliminarImagenHuerfana(nombreImagen);
    return next(error);
  }
});

module.exports = router;
