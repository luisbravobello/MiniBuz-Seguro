# ADR · csrf.js, Token CSRF por sesión (MiniBuzón Seguro)

Nov 14, 2026 · @Luis Alejandro Bravo Bello · Grupo G4 con Angel · Rama `feature/G4/CSRF-Luis`

---

## ADR-001 · Cómo protegí las acciones del administrador contra CSRF

**Estado:** Aceptada. El código está en mi rama y probado con una app de prueba; falta integrarlo con `auth.js`, `routes/admin.js` y `server.js`. **Decisión:** un token aleatorio guardado en la sesión, que el navegador manda en la cabecera `X-CSRF-Token` y que el servidor compara en tiempo constante, más una revisión de `Origin` como complemento.

### El problema

El administrador entra con una cookie de sesión. Esa cookie viaja sola en cada petición, aunque la petición la haya provocado otra página. Si el administrador tiene abierto MiniBuzón y visita una página maliciosa, esa página puede hacer que su navegador mande un `DELETE /api/admin/reportes/3` y el servidor lo aceptaría, porque la cookie es válida.

`SameSite=Lax` ayuda, pero el documento de especificación lo dice claro: no sustituye al token. Mi archivo es la segunda defensa. Solo las rutas que cambian datos la usan: el borrado de reportes y el cierre de sesión.

### Qué exporta `csrf.js`

| Función | Dónde se usa | Qué hace |
|---|---|---|
| `generarToken(req)` | Interna, la usa `emitirToken` | Devuelve el token de la sesión. Si no existe, crea 32 bytes aleatorios y los guarda en `req.session.csrfToken` |
| `emitirToken` | `GET /api/admin/csrf` | Responde `{ "csrfToken": "..." }` con `Cache-Control: no-store` |
| `validarCsrf` | DELETE de reportes y logout | Rechaza con 403 si el token falta, no coincide o el `Origin` es ajeno |
| `origenPermitido(req)` | Interna, la usa `validarCsrf` | Compara el host de `Origin` con el de `Host` |

### Cómo se monta

```js
const { emitirToken, validarCsrf } = require('./csrf');

router.get('/csrf', requireAdmin, emitirToken);
router.post('/logout', requireAdmin, validarCsrf, logout);
router.delete('/reportes/:id', requireAdmin, validarCsrf, borrarReporte);
```

El orden importa: primero la sesión (401) y después el token (403). Así "eliminar sin login" y "eliminar sin token" dan los códigos que pide la lista de comprobación.

### Decisiones

**D1. El token vive en la sesión del servidor.**
Se guarda en `req.session.csrfToken`. Como el proyecto ya tiene sesión con `express-session`, no hace falta una tabla ni una cookie más. Cuando Angel regenera la sesión al iniciar sesión, el token también es nuevo; cuando la destruye al cerrar sesión, el token desaparece con ella.

**D2. 32 bytes de `node:crypto`, en hexadecimal.**
`crypto.randomBytes(32)` da 256 bits de un generador seguro. No usé `Math.random()` porque es predecible. En hexadecimal son 64 caracteres, fáciles de poner en una cabecera.

**D3. Va en la cabecera `X-CSRF-Token`.**
El `DELETE` no lleva formulario, y un token en la URL quedaría en los registros del servidor y en el historial. Una cabecera personalizada además no se puede mandar desde una página de otro origen sin permiso del servidor. El frontend de Alejandro la agrega en cada `fetch` que cambia datos.

**D4. Comparación en tiempo constante.**

```js
function tokensIguales(esperado, recibido) {
  if (typeof esperado !== 'string' || typeof recibido !== 'string') return false;
  const a = crypto.createHash('sha256').update(esperado).digest();
  const b = crypto.createHash('sha256').update(recibido).digest();
  return crypto.timingSafeEqual(a, b);
}
```

`timingSafeEqual` exige dos buffers del mismo largo y lanza error si no lo son. Comparo los SHA-256 de ambos valores, que siempre miden 32 bytes, así un token de cualquier largo recibe el mismo trato y no hay excepción que revele nada.

**D5. Solo valido lo que cambia datos.**
`GET`, `HEAD` y `OPTIONS` pasan sin token. Todo lo demás (`POST`, `PUT`, `PATCH`, `DELETE`) tiene que traerlo. Si mañana alguien agrega una ruta de escritura y la pasa por `validarCsrf`, queda protegida sin tocar mi archivo.

**D6. Reviso `Origin` como complemento.**
Si el navegador manda `Origin`, su host tiene que ser el mismo de la cabecera `Host`. Eso funciona igual en `localhost:3000` y en la IP de la red local. Si no viene `Origin` no bloqueo, porque algunas peticiones legítimas no lo traen; ahí manda el token. Un `Origin` que no se puede interpretar (por ejemplo `null`) se rechaza.

**D7. Un solo mensaje de error.**
Todos los fallos devuelven `403` con `{ "error": "Solicitud no permitida." }`. No digo si faltaba el token, si estaba alterado o si el origen era ajeno, para no darle pistas a quien prueba.

**D8. Si falta la sesión, falla fuerte.**
Si `express-session` no está montado antes de mis funciones, `generarToken` lanza un error claro en vez de seguir sin protección. El manejador de errores de Jorge lo convierte en un 500 sin detalles.

### Lo que consideré y descarté

| Opción | Por qué no |
|---|---|
| Solo `SameSite=Lax` | La especificación dice que no sustituye al token; hay navegadores y casos donde no basta |
| Solo revisar `Origin` o `Referer` | A veces no vienen. Por eso es un complemento y no la defensa principal |
| Doble cookie (double submit) | Ya tenemos sesión en el servidor; el token sincronizador es más simple y no depende de una cookie legible por JavaScript |
| Paquete `csurf` u otro | El proyecto no permite agregar dependencias sin aprobarlas con Jorge, y `csurf` está marcado como obsoleto. Con `node:crypto` alcanza con poco código |
| Token nuevo en cada petición | Rompe el uso con dos pestañas abiertas y el botón de atrás; un token por sesión alcanza |
| Comparar con `===` | No es de tiempo constante |
| Token en el cuerpo o en la URL | El `DELETE` no lleva formulario, y la URL queda en registros e historial |

### Consecuencias

- **El token no protege si hay XSS.** Un script que corra en el mismo origen puede pedir `/api/admin/csrf` y leerlo. Por eso el render con `textContent` de Alejandro es obligatorio; mis dos defensas se complementan.
- **Login y envío de reportes no llevan token.** Son públicos y todavía no hay sesión que robar. El login sin protección CSRF queda como límite conocido; `origenPermitido` está exportado por si Jorge quiere aplicarlo ahí.
- **Reiniciar el servidor borra los tokens.** Las sesiones están en MemoryStore, así que el administrador tiene que entrar de nuevo.
- **HTTP en la red local no cifra nada.** El token viaja en claro; alguien en la misma red podría verlo. Es el límite que ya documentó la especificación.
- Si no viene `Origin`, solo queda el token. Es suficiente, pero es una sola capa en ese caso.

### Lo que necesito de los demás

| Quién | Archivo | Qué necesito |
|---|---|---|
| Angel | `auth.js` | Regenerar la sesión al iniciar sesión (`req.session.regenerate`) y destruirla en el logout |
| John | `routes/admin.js` | Poner `validarCsrf` después de `requireAdmin` en el DELETE de reportes |
| Jorge | `server.js` | Montar `express-session` antes de las rutas, sin proxy delante (la revisión de `Origin` usa `Host`) |
| Alejandro | `public/app.js` | Pedir `GET /api/admin/csrf` después del login, guardar el token en una variable (no en `localStorage`) y mandarlo en `X-CSRF-Token` en el DELETE y el logout |

---

## ADR-002 · Cómo lo probé

**Estado:** Aceptada. **Decisión:** probar `csrf.js` solo, con una app mínima de Express, antes de que existan los archivos de los demás. Fueron 23 comprobaciones y todas pasaron.

### Contexto

Mi archivo depende de la sesión de Angel y de las rutas de John, que todavía no existen. Para no esperarlos armé una app de prueba fuera del repositorio con `express` y `express-session`: un login falso que regenera la sesión, un `requireAdmin` de mentira y un `DELETE` que cuenta cuántas veces se ejecutó. Así podía comprobar no solo el código de respuesta, sino que no se borrara nada cuando se rechazaba.

### Qué probé

| Caso | Resultado |
|---|---|
| DELETE sin haber iniciado sesión | 401, no borra |
| DELETE sin token, con token vacío o con un valor inventado | 403, no borra |
| DELETE con el token válido cambiando solo un carácter | 403, no borra |
| DELETE con token válido y `Origin` de otro sitio o `null` | 403, no borra |
| DELETE con token válido, sin `Origin` o con el `Origin` propio | 200, borra |
| Token de la sesión A usado en la sesión B | 403 |
| Iniciar sesión otra vez | Token nuevo; el viejo da 403 |
| Logout sin token / con token | 403 / 200 |
| DELETE con el token viejo después del logout | 401 |
| Forma del token | 64 caracteres hexadecimales, `Cache-Control: no-store`, el mismo dentro de una sesión |

### Lo que no cubre

- **Corrí las pruebas en Node 22** con las últimas versiones de `express` y `express-session`, no con las versiones fijadas del proyecto (Node 24, `express 5.3.0`). Mi archivo solo usa `node:crypto`, pero hay que repetir la prueba con el proyecto ya instalado.
- **Falta la prueba integrada** con el `auth.js` de Angel, el router de John y el frontend de Alejandro, y la prueba desde otro equipo de la red local.
- El Pull Request a `develop` todavía no está abierto; lo abro cuando Angel y yo probemos nuestras dos piezas juntas, como pide el documento.

### Implementación

Archivo modificado: `csrf.js`. Rama: `feature/G4/CSRF-Luis`. Commit: `feat(csrf): token CSRF por sesion y validacion de X-CSRF-Token`. Depende de `express-session` (configurado por Jorge en `server.js`) y de `auth.js` de Angel.

Versión con el diseño del compendio: `docs/ADR/ADR_Luis_CSRF.pdf`.
