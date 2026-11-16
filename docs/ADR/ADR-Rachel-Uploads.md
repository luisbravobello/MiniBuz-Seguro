# ADR: Validación y Almacenamiento Seguro de Imágenes

- **Autor:** Rachel (G5 - Seguridad e Integración)
- **Fecha:** 2026-11-16
- **Estado:** Aceptado

## Contexto
El sistema permite a los usuarios adjuntar una imagen opcional a cada reporte. La subida de archivos es un vector de ataque crítico que puede permitir ejecución remota de comandos (RCE), XSS almacenado (vía SVG/HTML), ataques de denegación de servicio (archivos gigantes) y sobrescritura de archivos del servidor (path traversal).

## Decisión
Se implementó un middleware centralizado (`uploads.js`) basado en `multer` y `sharp` aplicando el principio de defensa en profundidad:

1. **Almacenamiento en memoria previo:** Se utiliza `multer.memoryStorage()` para inspeccionar el archivo en memoria antes de tocar el sistema de archivos.
2. **Límite de tamaño:** Restricción estricta a 2 MiB por archivo y un único archivo por petición (`single('imagen')`).
3. **Validación por Magic Bytes:** No se confía en la extensión provista por el cliente ni en el encabezado `Content-Type`. Se inspeccionan directamente los primeros bytes del buffer:
   - JPG: `FF D8 FF`
   - PNG: `89 50 4E 47 0D 0A 1A 0A`
   Formatos ejecutables o con soporte de scripts (SVG, HTML, PHP) son rechazados inmediatamente con código 400.
4. **Renombrado aleatorio y descarte de nombres originales:** Se descarta el nombre provisto por el usuario y se genera un UUID v4 criptográfico (`crypto.randomUUID()`) con la extensión detectada por firma. Esto previene path traversal (`../`) y dobles extensiones (`shell.php.jpg`).
5. **Re-codificación con Sharp:** Toda imagen admitida es decodificada y procesada con `sharp` antes de escribirse a disco. Esto purga metadatos maliciosos (EXIF XSS) y garantiza que el binario es una imagen válida.
6. **Almacenamiento privado:** Se escribe en la carpeta aislada `private-uploads/`, excluida del versionado en Git y fuera de los directorios estáticos públicos del servidor.

## Consecuencias
- **Positivas:** Se mitiga por completo RCE, XSS mediante imágenes vectoriales y path traversal. La base de datos solo almacena el identificador seguro (`nombreArchivo`).
- **Limitaciones asumidas:** Se consume memoria temporal por imagen recibida (mitigado por el límite de 2 MiB y 1 solo archivo).
