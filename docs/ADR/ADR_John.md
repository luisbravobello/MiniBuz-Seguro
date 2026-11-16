# ADR - John

**Grupo:** G1  
**Tema:** Rutas administrativas y autorizacion  
**Rama:** feature/G1/Admin-John  
**Fecha:** 15 de noviembre de 2026

## Contexto
Me toco hacer `routes/admin.js`, que tiene las rutas que solo puede usar el administrador: listar y buscar reportes, eliminar un reporte y ver la imagen que se subio. El problema principal era como proteger esas rutas para que nadie sin sesion pudiera ver los reportes ni borrar nada, y que el borrado no se pudiera hacer desde otra pagina usando la sesion del admin (CSRF).

## Alternativas consideradas
- Revisar la sesion dentro de cada ruta con un `if`. Funciona, pero se repite el mismo codigo en todas las rutas y es facil que a uno se le olvide en alguna.
- Poner un solo middleware para todo el router. Es mas corto, pero la ruta de listar no necesita CSRF y la de eliminar si, entonces no queda tan claro que protege cada cosa.
- Usar los middlewares de Angel (`requireAdmin`) y Chamo (`verificarCsrf`) en cada ruta segun lo que necesite.

Para la imagen pense en servir la carpeta `private-uploads` con `express.static`, pero eso la deja publica y la especificacion dice que solo el admin puede verla.

## Decision
Elegi la tercera opcion. Cada ruta lleva `requireAdmin` y la de eliminar lleva tambien `verificarCsrf`. El orden importa: primero se revisa la sesion y despues el token, asi una peticion sin login da 401 y una con login pero sin token da 403, que es lo que pide la lista de pruebas.

Tambien decidi:
- Validar el `id` con una expresion regular para que solo pasen enteros positivos antes de llegar a la base de datos.
- Limitar `buscar` a 120 caracteres y rechazarlo si no es texto (por ejemplo si mandan `?buscar=a&buscar=b`). La consulta en si la hace Junior con parametros, yo no armo SQL.
- No devolver el nombre del archivo en la lista, solo `tieneImagen`. El frontend pide la imagen por el id del reporte.
- Para la imagen uso `res.sendFile` con la opcion `root` y compruebo que el nombre guardado no tenga carpetas (`path.basename`), asi no se puede salir de `private-uploads`.
- Al eliminar, primero borro el registro y despues el archivo. Si el archivo no existe no pasa nada; si falla por otra cosa se escribe en consola.

## Consecuencias
Ventajas: las rutas quedan cortas y se ve rapido que protege cada una. Si cambia la forma de validar la sesion o el token, solo se cambia en `auth.js` o `csrf.js`.

Limitaciones: dependo de que Angel y Chamo exporten esos nombres; si los cambian hay que ajustar el `require`. Como la BD y los archivos no van en la misma transaccion, puede quedar una imagen huerfana si falla el borrado del archivo, pero queda registrado en consola para borrarla a mano.

Riesgo: si hubiera un XSS en el frontend, el token CSRF no serviria de mucho porque el script correria en el mismo origen. Eso lo cubre Alejandro mostrando los datos con `textContent`.

## Implementacion
Archivo modificado: `routes/admin.js`.

Rutas (montadas en `/api/admin` desde `server.js`):
- `GET /reportes?buscar=` - lista o busca.
- `DELETE /reportes/:id` - elimina con sesion y token CSRF.
- `GET /reportes/:id/imagen` - devuelve la imagen privada.

Pruebas que hice / hay que hacer al integrar:
- Eliminar sin login: 401 y el reporte sigue.
- Eliminar con login pero sin `X-CSRF-Token` o con token cambiado: 403.
- Abrir `/api/admin/reportes/1/imagen` sin sesion: rechazado.
- Buscar `' OR 1=1 --`: no devuelve todo, solo lo que coincida con el texto.
- Mandar un id como `abc` o `-1`: 400.