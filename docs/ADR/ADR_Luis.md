# ADR - Luis

**Grupo:** G4  
**Tema sugerido:** CSRF por sesion  
**Rama:** `feature/G4/CSRF-Luis`  
**Fecha:** 2026-11-14

## Contexto
El administrador entra con una cookie de sesion que el navegador manda sola en cada peticion. Si visita una pagina maliciosa mientras tiene abierto MiniBuzon, esa pagina puede provocar un `DELETE /api/admin/reportes/:id` y el servidor lo aceptaria. `SameSite=Lax` ayuda pero, segun la especificacion, no sustituye al token. `csrf.js` es la segunda defensa y solo la usan las rutas que cambian datos: borrar reportes y cerrar sesion.

## Alternativas consideradas
- Solo `SameSite=Lax`: no basta.
- Solo revisar `Origin`/`Referer`: a veces no vienen; queda como complemento.
- Doble cookie (double submit): ya hay sesion en el servidor, el token sincronizador es mas simple.
- Paquete `csurf` u otro: no se agregan dependencias sin aprobar con Jorge y `csurf` esta obsoleto.
- Token nuevo en cada peticion: rompe el uso con varias pestañas y el boton de atras.
- Comparar con `===`: no es de tiempo constante.
- Token en el cuerpo o en la URL: el DELETE no lleva formulario y la URL queda en registros.

## Decision
- Token aleatorio de 32 bytes (`crypto.randomBytes`, hexadecimal) guardado en `req.session.csrfToken`; se crea la primera vez que se pide.
- Se envia en la cabecera `X-CSRF-Token` y se compara en tiempo constante (SHA-256 de ambos valores + `timingSafeEqual`).
- `validarCsrf` solo exige token en metodos que cambian datos (POST, PUT, PATCH, DELETE).
- Se revisa que el host de `Origin` coincida con `Host`, como complemento. Si no hay `Origin`, manda el token.
- Cualquier fallo responde `403` con el mismo mensaje generico.
- Orden en las rutas: primero `requireAdmin` (401), despues `validarCsrf` (403).

## Consecuencias
- El token no protege si hay XSS en el mismo origen: el render con `textContent` es obligatorio.
- Login y `POST /api/reportes` son publicos y no llevan token; el login sin proteccion CSRF es un limite conocido (`origenPermitido` esta exportado por si Jorge lo quiere aplicar).
- Reiniciar el servidor borra las sesiones (MemoryStore) y con ellas los tokens.
- HTTP en la red local no cifra el trafico: el token viaja en claro.
- Necesito: de Angel, `req.session.regenerate` al login y destruir la sesion en logout; de John, `validarCsrf` despues de `requireAdmin` en el DELETE; de Jorge, `express-session` montado antes de las rutas y sin proxy; de Alejandro, pedir `GET /api/admin/csrf` tras el login y mandar `X-CSRF-Token` en DELETE y logout (token en una variable, no en `localStorage`).

## Implementacion
Archivo modificado: `csrf.js` (exporta `generarToken`, `emitirToken`, `validarCsrf`, `origenPermitido`).

Prueba realizada: app minima de Express con `express-session`, login falso y un DELETE que cuenta ejecuciones. 23 comprobaciones, todas pasaron: DELETE sin login (401), sin token / vacio / inventado / con un caracter cambiado (403), con `Origin` ajeno o `null` (403), con token valido (200), token de otra sesion (403), token nuevo tras volver a iniciar sesion, logout sin token (403) y con token (200). En todos los rechazos no se borro nada.

Limites de la prueba: se corrio en Node 22 con las ultimas versiones de `express` y `express-session`, no con las versiones fijadas del proyecto. Falta la prueba integrada con `auth.js`, `routes/admin.js` y `public/app.js`, y la prueba desde otro equipo de la red local. El Pull Request a `develop` se abre cuando Angel y yo probemos nuestras piezas juntas.

Version con el diseño del compendio: `docs/ADR/ADR_Luis_CSRF.pdf`.
