# Autenticacion - Angel

`auth.js` registra las rutas; `auth/password.js` genera y verifica hashes scrypt.
Se separan esas responsabilidades con funciones pequenas, sin clases ni dependencias nuevas.

## Integracion con Jorge, John y G4 CSRF

Jorge debe configurar primero `express.json()` con limite de cuerpo y `express-session`:
`resave: false`, `saveUninitialized: false`, secreto desde `SESSION_SECRET`,
cookie `httpOnly: true`, `sameSite: 'lax'`, `path: '/'` y expiracion razonable.
`secure` debe ser true al usar HTTPS; para la demo HTTP local, false.

Despues de esos middlewares, registrar una sola vez:

```js
const { registerAuthRoutes, requireAdmin } = require('./auth');
registerAuthRoutes(app, {
  requireCsrf, // funcion real exportada por csrf.js; acordar su nombre con G4
  // cookieName: 'connect.sid', // indicar aqui si Jorge cambia el nombre
});
```

John importa `requireAdmin` desde `../auth` para proteger sus rutas.
La identidad acordada es `req.session.isAdmin === true`.
El modulo requiere el middleware CSRF al registrar las rutas: logout ejecuta
`requireAdmin`, luego `requireCsrf` y solo entonces destruye la sesion.
El middleware CSRF debe responder 403 sin llamar a `next()` si el token falla.
Jorge conserva el manejo central de errores y los limites de intentos de login.
Este modulo no configura Express, no genera tokens CSRF y no consulta SQLite.

## Contrato para Alejandro

| Peticion | Resultado |
| --- | --- |
| `POST /api/admin/login`, JSON `{ "password": "..." }` | 200 `{ "authenticated": true }`; 400 entrada invalida; 401 clave incorrecta |
| `GET /api/admin/session` | 200 `{ "authenticated": true }`; 401 sin sesion |
| `POST /api/admin/logout`, cookie y `X-CSRF-Token` | 200 `{ "authenticated": false }`; 401 sin sesion; 403 CSRF invalido |

Los errores de autenticacion usan `{ "error": "mensaje" }`. Un fallo interno se
delega al manejador de Jorge, que debe devolver un error generico sin trazas.
Tras login hay una sesion nueva: solicitar un token CSRF nuevo antes de logout o DELETE.
No se devuelve contrasena, hash, ID de sesion ni secretos en JSON.

## Generar el hash local

En una terminal local ejecutar `node`, y dentro de su REPL:

```js
const { hashPassword } = require('./auth/password');
await hashPassword('CLAVE_FICTICIA_SOLO_PARA_DEMO');
```

Copiar el resultado completo (sin comillas) a `ADMIN_PASSWORD_HASH` en `.env`.
Usar una clave ficticia y no versionar ni compartir ese archivo. El formato es
`scrypt$<sal hexadecimal de 16 bytes>$<clave derivada hexadecimal de 64 bytes>`.
Parametros: N=131072, r=8, p=1. La sal es aleatoria por hash. No hay clave por defecto.

## Pruebas aisladas

`node --test auth/auth.test.js`

Usan el runner de Node y dobles de los contratos Express/sesion, sin instalar paquetes
ni modificar archivos de otros integrantes. La prueba completa HTTP con cookies,
sesion y middleware CSRF real queda pendiente de la integracion de Jorge/G4.
