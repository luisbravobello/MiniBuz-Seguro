// TODO Johansell: router POST /api/reportes; validacion, uploads.js, reportRepository.js.
const express = require('express');
const multer = require('multer');
const { guardarImagen, eliminarImagen } = require('../uploads');
const { crearReporte } = require('../reportRepository');

const router = express.Router();


// 1. Configurar multer: recibe UNA imagen de maximo 2 MiB y la deja en memoria
const subida = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: 2 * 1024 * 1024, // 2 MiB
  },
}).single('imagen');


// 2. Funcion para revisar titulo y mensaje.
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


// 3. La ruta
router.post('/', (req, res) => {
  // 3.1 Multer lee el formulario
  subida(req, res, async (error) => {
    if (error) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'La imagen supera los 2 MiB.' });
      }
      return res.status(400).json({ error: 'Solo se permite una imagen JPG o PNG.' });
    }

    // 3.2 Validar titulo y mensaje ANTES de guardar nada
    const datos = req.body || {};
    const titulo = validarTexto(datos.titulo, 120);
    const mensaje = validarTexto(datos.mensaje, 2000);

    if (titulo === null || mensaje === null) {
      return res.status(400).json({
        error: 'El titulo debe tener de 1 a 120 caracteres y el mensaje de 1 a 2000.',
      });
    }

    // 3.3 Si viene imagen, Rachel la valida y la guarda
    let nombreImagen = null;
    if (req.file) {
      try {
        nombreImagen = await guardarImagen(req.file);
      } catch (e) {
        return res.status(400).json({ error: 'La imagen no es valida.' });
      }
    }

    // 3.4 Guardar el reporte en SQLite (Junior)
    try {
      const id = await crearReporte({ titulo, mensaje, imagen: nombreImagen });
      return res.status(201).json({ id: Number(id), mensaje: 'Reporte enviado.' });
    } catch (e) {
      // Si falla la base de datos, borramos la imagen para no dejarla huerfana
      if (nombreImagen) {
        try {
          await eliminarImagen(nombreImagen);
        } catch (e2) {
          console.error('No se pudo borrar la imagen huerfana');
        }
      }
      console.error('Error al guardar el reporte');
      return res.status(500).json({ error: 'No se pudo guardar el reporte.' });
    }
  });
});

module.exports = router;