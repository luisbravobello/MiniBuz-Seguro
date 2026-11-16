const multer = require('multer');
const sharp = require('sharp');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const UPLOADS_DIR = path.join(__dirname, 'private-uploads');
const MAX_SIZE = 2 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE, files: 1 }
}).single('imagen');

function validarFirma(buf) {
  if (!buf || buf.length < 8) return null;
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'jpg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47 &&
      buf[4] === 0x0D && buf[5] === 0x0A && buf[6] === 0x1A && buf[7] === 0x0A) return 'png';
  return null;
}

function procesarImagen(req, res, next) {
  upload(req, res, async (err) => {
    if (err) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ error: 'Archivo supera el límite o es inválido' });
    }

    if (!req.file) {
      req.imagen = null;
      return next();
    }

    const ext = validarFirma(req.file.buffer);
    if (!ext) {
      return res.status(400).json({ error: 'Formato no soportado' });
    }

    const nombreArchivo = `${crypto.randomUUID()}.${ext}`;
    const destino = path.join(UPLOADS_DIR, nombreArchivo);

    try {
      await fs.mkdir(UPLOADS_DIR, { recursive: true });
      if (ext === 'jpg') {
        await sharp(req.file.buffer).jpeg().toFile(destino);
      } else {
        await sharp(req.file.buffer).png().toFile(destino);
      }
      req.imagen = { nombreArchivo };
      next();
    } catch {
      return res.status(400).json({ error: 'Archivo dañado o inválido' });
    }
  });
}

module.exports = { procesarImagen, UPLOADS_DIR };