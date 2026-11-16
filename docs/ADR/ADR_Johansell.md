# ADR - Johansell

**Grupo:** G1  
**Tema:** Recibir y validar reporte en Express  
**Rama:** feature/G1/Reportes-Johansell  
**Fecha:** 15 de noviembre de 2026  
**Estado:** Aceptada. Codigo listo en mi rama; las pruebas se haran al integrar con `uploads.js`, `reportRepository.js` y `server.js`.

## Contexto
Me toco hacer `routes/reportes.js`, que tiene la ruta publica `POST /api/reportes`. Es la unica parte del sistema que recibe datos de cualquier persona sin iniciar sesion, por eso es la mas expuesta. El reporte llega como `multipart/form-data` con `titulo` (1-120 caracteres), `mensaje` (1-2000) y una `imagen` opcional (JPG/PNG, maximo 2 MiB). El problema era como recibir el formulario, validar los datos en el servidor y guardar el reporte sin dejar archivos peligrosos o huerfanos en el disco.

## Alternativas consideradas
- Validar solo en el frontend. Es mas facil, pero cualquiera puede saltarse la pagina y mandar la peticion directo con Postman o `curl`, asi que el servidor no puede confiar en el navegador.
- Guardar la imagen con `multer.diskStorage`. Asi el archivo se escribe en disco apenas llega, aunque despues resulte ser falso o el reporte tenga datos invalidos.
- Guardar la imagen con `multer.memoryStorage`. El archivo queda en memoria (maximo 2 MiB) y solo se escribe cuando Rachel lo valida con Sharp.
- Quitar o escapar el HTML del titulo y mensaje antes de guardarlos. Parece mas seguro, pero cambia lo que escribio el usuario y la defensa contra XSS se hace al mostrar el texto, no al guardarlo.

## Decision
Elegi validar en el servidor y usar `memoryStorage`.

Tambien decidi:
- Configurar multer con `files: 1` y `fileSize: 2 MiB`, y aceptar el archivo solo en el campo `imagen` (`.single('imagen')`). Si mandan dos archivos o uno en otro campo se responde 400; si pesa mas de 2 MiB, 413.
- Validar `titulo` y `mensaje` con una funcion `validarTexto`: que sean texto, quitar espacios con `trim()` y revisar el largo. Asi un titulo de puros espacios se rechaza.
- Validar el texto antes de procesar la imagen, para no guardar nada si el reporte ya viene mal.
- Guardar el texto tal cual. Alejandro lo muestra con `textContent`, asi que un `<script>` se ve como texto y no se ejecuta.
- No armar SQL en mi archivo. Llamo a `crearReporte` de Junior, que usa sentencias preparadas.
- Si el INSERT falla despues de guardar la imagen, llamo a `eliminarImagen` para borrarla y que no quede huerfana.
- Responder con mensajes genericos y sin detalles internos: 201 si se guardo, 400 si los datos o la imagen no sirven, 413 si la imagen es muy grande y 500 si falla el servidor. Al cliente solo le devuelvo el `id`, no el nombre interno de la imagen.

## Consecuencias
Ventajas: la ruta es corta y facil de seguir. Ningun archivo toca el disco antes de ser validado, y aunque el frontend falle o lo salten, el servidor aplica los mismos limites.

Limitaciones:
- Dependo de que Rachel exporte `guardarImagen` y `eliminarImagen` y Junior `crearReporte` con esos nombres; si los cambian hay que ajustar el `require`.
- Cualquier error de `guardarImagen` lo respondo como 400 "imagen no valida", aunque la causa fuera del servidor (por ejemplo, disco lleno).
- Uso `.length` para contar caracteres. Un emoji cuenta como 2, asi que un titulo con muchos emojis se puede rechazar un poco antes del limite real. Nunca deja pasar mas de lo que permite la base de datos.
- No limite cuantos reportes puede mandar una persona por minuto; alguien podria llenar la base con spam. Lo deje fuera para mantener el codigo simple.

Riesgo: la base de datos y la carpeta de imagenes no comparten transaccion. Si fallan a la vez el INSERT y el borrado de la imagen, queda un archivo huerfano; se escribe en consola para borrarlo a mano.

## Implementacion
Archivo modificado: `routes/reportes.js`.

Ruta (montada en `/api/reportes` desde `server.js`):
- `POST /` - recibe titulo, mensaje e imagen opcional y crea el reporte.

Pruebas que hay que hacer al integrar con Rachel, Junior y Jorge:
- Enviar titulo y mensaje validos sin imagen: 201 y el reporte aparece en SQLite.
- Enviar con un JPG o PNG real de menos de 2 MiB: 201 y la imagen queda en `private-uploads`.
- Titulo vacio o de puros espacios, o mensaje de mas de 2000 caracteres: 400.
- Imagen de mas de 2 MiB: 413.
- Dos imagenes, o un `.exe` renombrado a `.png`: 400.
- Titulo con `<script>alert(1)</script>`: se guarda y en el panel se ve como texto.
- Titulo con `' OR 1=1 --`: se guarda como texto normal, no altera la base de datos.

PR: hacia `develop`, lo integra Jorge.