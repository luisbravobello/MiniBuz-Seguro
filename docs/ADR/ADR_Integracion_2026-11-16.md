# ADR - Integracion de contratos del MiniBuzon Seguro

- **Proyecto:** MiniBuzon Seguro
- **Rama revisada:** `develop`
- **Fecha:** 16 de noviembre de 2026
- **Estado:** Implementado y verificado localmente
- **Alcance:** Correcciones de integracion; no se cambia el esquema de SQLite ni la arquitectura.

## Contexto

La aplicacion mostraba el frontend, pero el panel administrativo fallaba tras
un login valido. La reproduccion integrada de `GET /api/admin/reportes` dio un
`500` y el servidor registro `TypeError: db.prepare is not a function` desde
`reportRepository.js`.

La causa era que los modulos integrados tenian contratos distintos a los que
finalmente exportaban sus dependencias:

- `database.js` es una fachada que exporta `obtenerDb()`, no una conexion con
  `prepare()` directamente.
- `crearReporte` recibe `titulo`, `mensaje` e `imagen` como parametros
  separados.
- `uploads.js` exporta `procesarImagen` y `UPLOADS_DIR`; no exporta
  `guardarImagen` ni `eliminarImagen`.
- La lista administrativa publica `tieneImagen`, no el nombre interno del
  archivo.
- `csrf.js` exporta `validarCsrf`, no `verificarCsrf`.

## Decision

Se conservan los limites de responsabilidad de cada modulo y se unifican los
consumidores con los contratos realmente definidos por sus autores.

1. `reportRepository.js` obtiene la conexion mediante `obtenerDb()` antes de
   preparar cada sentencia.
2. `routes/reportes.js` usa `procesarImagen` como el unico middleware de
   multipart y normalizacion. Despues inserta con
   `crearReporte(titulo, mensaje, nombreImagen)`.
3. Si falla la validacion posterior o el INSERT de SQLite, la ruta borra la
   imagen ya normalizada usando el nombre aleatorio y `UPLOADS_DIR`.
4. `routes/admin.js` consume `validarCsrf` directamente y `server.js` deja de
   mutar el modulo CSRF con un adaptador temporal.
5. El cliente consulta `tieneImagen`; la imagen se pide por la ruta privada
   autenticada y nunca se entrega su nombre o ruta al navegador.

## Alternativas descartadas

- Exportar una conexion global llamada `db` desde `database.js`: rompe la
  fachada de datos y su ciclo de inicializacion.
- Mantener dos configuraciones de Multer: recibiria el mismo adjunto dos veces
  y puede provocar resultados inconsistentes.
- Publicar `private-uploads` con `express.static`: convertiría los adjuntos en
  recursos sin control de sesion.
- Mantener el alias `verificarCsrf`: oculta una incompatibilidad de contrato y
  deja una mutacion innecesaria en el arranque.

## Implementacion y responsables originales

| Archivo modificado | Responsable original | Cambio de integracion |
| --- | --- | --- |
| `reportRepository.js` | Junior | Uso de `obtenerDb()` antes de `prepare()`. |
| `routes/reportes.js` | Johansell | Uso unico de `procesarImagen`, contrato posicional del repositorio y limpieza de huerfanos. |
| `routes/admin.js` | John | Importacion de `validarCsrf`. |
| `public/app.js` | Alejandro | Consulta de `tieneImagen`. |
| `server.js` | Jorge | Eliminacion del adaptador CSRF temporal. |

No se modificaron `uploads.js` (Rachel), `csrf.js` (Luis), `auth.js` (Angel),
el esquema SQLite ni `.env`.

## Consecuencias

- `GET /api/admin/reportes` vuelve a usar SQLite correctamente despues del
  login.
- Las imagenes solo se procesan una vez, con la validacion de firma y
  decodificacion de `uploads.js`.
- Un fallo de SQLite no deja deliberadamente una imagen asociada sin reporte;
  un fallo adicional del sistema de archivos se registra para limpieza manual.
- El contrato de CSRF queda explicito y el orden de proteccion se conserva:
  sesion administrativa (`401`) antes de token CSRF (`403`).

## Verificacion ejecutada

- `node --test auth/auth.test.js database/database.test.js`: 33 pruebas
  aprobadas.
- Prueba HTTP integrada en una instancia local aislada:
  - inicializacion de SQLite;
  - envio de reportes sin imagen y con PNG valido;
  - rechazo de firma falsa (`400`) y archivo mayor de 2 MiB (`413`);
  - login correcto e incorrecto, sesion, emision CSRF y logout;
  - listado, busqueda, visualizacion privada de imagen y eliminacion;
  - eliminacion sin token o con token alterado (`403`);
  - SQL injection de busqueda tratada como texto;
  - titulo XSS conservado como texto, compatible con el uso de `textContent`;
  - comprobacion de que `/.env`, `/data/minibuzon.db` y
    `private-uploads` no se sirven desde Express (`404`).
- `git diff --check`: sin errores de espacios.

## Pendientes

- Reiniciar el proceso local que sirve el puerto 3000 para cargar los cambios.
- Las sesiones usan `MemoryStore` y no se implemento limitacion de intentos de
  login; son limites conocidos para la demostracion local y pruebas en LAN
  controlada.
