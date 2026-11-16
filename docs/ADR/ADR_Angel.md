# ADR Auth

**Número:** Pendiente de asignación por el líder.

**Integrante:** Ángel

**Grupo:** G4

**Tema:** Autenticación del administrador y manejo de sesiones

**Rama:** feature/G4/Auth-Angel

**Fecha:** 15 de noviembre de 2026

**Estado:** Implementada en mi rama, pendiente de integración. Las 10 pruebas aisladas pasaron; falta probar el flujo HTTP con `server.js`, `express-session` y el middleware CSRF real.

## Contexto

Me tocó hacer la autenticación del único administrador en `auth.js`. Cualquier persona puede enviar reportes, pero solo el administrador puede consultarlos, buscar, ver imágenes y eliminarlos. Necesitaba comprobar su contraseña, mantener la sesión y ofrecer una protección que John pudiera usar en las rutas administrativas.

El proyecto tiene una sola tabla de reportes, así que la contraseña no se guarda en SQLite. Su hash se configura localmente en `ADMIN_PASSWORD_HASH`. Jorge configura `express-session` en `server.js` y mi compañero de G4 implementa los tokens CSRF.

## Alternativas consideradas

- Guardar la contraseña en texto. Es sencillo, pero expone directamente la clave si se filtra la configuración.
- Crear una tabla de usuarios. Permite varias cuentas, pero agrega una tabla y funciones que quedan fuera del alcance acordado.
- Usar JWT. Agrega manejo de tokens cuando el proyecto ya tiene previstas sesiones con cookie.
- Guardar un hash scrypt en una variable de entorno y usar sesiones de servidor. Encaja con la cuenta única y utiliza `node:crypto`, sin nuevas dependencias.

## Decisión

Elegí un hash scrypt y sesiones de servidor.

También decidí:

- Separar las responsabilidades: `auth.js` maneja las rutas y la sesión; `auth/password.js` genera y verifica hashes. Uso funciones pequeñas e inyecto el middleware CSRF para mantener el módulo independiente de su implementación.
- Generar una sal aleatoria de 16 bytes por hash, con parámetros scrypt fijos `N=131072`, `r=8`, `p=1` y una clave derivada de 64 bytes. La comprobación usa `timingSafeEqual`.
- Validar `ADMIN_PASSWORD_HASH` al registrar las rutas. Si falta o tiene un formato inválido, la configuración falla; no hay contraseña por defecto.
- Recibir la contraseña en el campo JSON `password`, exigir que sea texto no vacío y limitarla a 1024 bytes. No aplico `trim()`, porque los espacios pueden formar parte de la clave.
- Regenerar la sesión después de comprobar la contraseña, marcar `req.session.isAdmin = true` y guardar antes de responder. La regeneración descarta el identificador y los datos anteriores, incluido cualquier token CSRF anterior.
- Exportar `requireAdmin` para proteger las rutas de John. Solo acepta `isAdmin === true` y responde 401 cuando no hay autenticación.
- Exigir un middleware `requireCsrf` al registrar las rutas. Logout ejecuta primero `requireAdmin`, después `requireCsrf` y solo entonces destruye la sesión y borra la cookie.
- Usar `Cache-Control: no-store` en las respuestas de autenticación y no devolver contraseñas, hashes ni identificadores de sesión en JSON.
- Delegar los errores internos al manejador central de Jorge para que responda sin trazas ni detalles privados.

## Consecuencias

Ventajas: el módulo es pequeño, no agrega tablas ni dependencias y separa la verificación de contraseñas del manejo HTTP. John puede reutilizar `requireAdmin` y el middleware CSRF se conecta sin implementar sus tokens dentro de mi módulo.

Limitaciones:

- Dependo de que Jorge configure `express.json()` y `express-session` antes de registrar las rutas, con un secreto de sesión, cookies adecuadas y manejo central de errores.
- Alejandro debe enviar `{ "password": "..." }` y solicitar un token CSRF nuevo después de iniciar sesión.
- El nombre de cookie predeterminado es `connect.sid`; si Jorge lo cambia, debe pasar el mismo nombre a `registerAuthRoutes`.
- Las pruebas usan dobles de Express, sesiones y CSRF. Todavía no demuestran el funcionamiento HTTP con cookies y los módulos reales integrados.
- No implementé límites de intentos de login; su configuración queda en la integración del servidor.
- Cambiar los parámetros scrypt exige regenerar el hash administrativo.

Riesgos: HTTP en LAN no cifra la contraseña ni la cookie, por lo que la demo debe usar una clave ficticia en la red autorizada. MemoryStore solo sirve para la demostración local y pierde las sesiones al reiniciar el servidor.

## Implementación

Archivos de mi módulo:

- `auth.js`: exporta `registerAuthRoutes` y `requireAdmin`.
- `auth/password.js`: genera y verifica hashes scrypt.
- `auth/auth.test.js`: pruebas aisladas de autenticación.
- `auth/README.md`: configuración, contratos y generación del hash local.
- `docs/ADR/ADR_Angel.md`: esta decisión.

Rutas registradas por `registerAuthRoutes(app, { requireCsrf })`:

- `POST /api/admin/login`: 200 al autenticar, 400 para entrada inválida y 401 para contraseña incorrecta.
- `GET /api/admin/session`: 200 con sesión administrativa; 401 sin ella.
- `POST /api/admin/logout`: exige sesión y CSRF; destruye la sesión y responde 200. Un token inválido debe recibir 403 desde el middleware CSRF.

Pruebas ejecutadas: `node --test auth/auth.test.js`. Pasaron las 10 pruebas: verificación de contraseña y sal aleatoria, configuración inválida, validación de entrada, contraseña incorrecta, regeneración y guardado de sesión, fallos internos, acceso protegido y cierre de sesión con o sin CSRF válido.

Pruebas pendientes al integrar con Jorge y G4:

- Iniciar sesión con la contraseña correcta y acceder a las rutas administrativas mediante la cookie real.
- Confirmar que el identificador de sesión cambia después del login.
- Intentar listar reportes o abrir imágenes sin sesión: 401.
- Cerrar sesión sin token o con un token alterado: 403 y sesión conservada.
- Cerrar sesión con un token válido y comprobar que la cookie se borra y las rutas administrativas vuelven a responder 401.

PR: pendiente hacia `develop`; lo integra Jorge. La numeración de este ADR queda a cargo del líder.
