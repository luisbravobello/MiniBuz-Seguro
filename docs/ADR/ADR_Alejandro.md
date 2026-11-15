# ADR - Alejandro

**Grupo:** G2  
**Tema sugerido:** JavaScript e interfaz segura  
**Rama:** feature/G2/JavaScript-Alejandro  
**Fecha:** 15/11/2026

## Contexto
El archivo public/app.js tiene que mandar el formulario de reportes, hacer el login del admin, listar y buscar reportes y eliminarlos. El problema es que los titulos y mensajes los escribe cualquier persona, entonces si los pinto en la pagina sin cuidado alguien puede meter un `<script>` y se ejecuta en el navegador del admin (XSS). Tambien el borrado necesita el token CSRF.

## Alternativas consideradas
- Armar el HTML con template strings e `innerHTML`. Es mas corto pero cualquier etiqueta que venga en el reporte se interpreta.
- Usar `innerHTML` pero escapando los caracteres a mano. Funciona, pero si se me olvida escapar un campo ya hay hueco.
- Crear los elementos con `createElement` y poner el texto con `textContent`.

## Decision
Me quede con `createElement` + `textContent`. Asi el navegador nunca interpreta lo que escribio el usuario, solo lo muestra como texto. No hay ningun `innerHTML` en el archivo.

Para las rutas uso `fetch` con `credentials: 'same-origin'` para que viaje la cookie de sesion. Antes de eliminar o cerrar sesion pido el token a `GET /api/admin/csrf` y lo mando en la cabecera `X-CSRF-Token`. Si el servidor responde 403 vuelvo a pedir el token una vez y reintento. El texto de busqueda va con `encodeURIComponent` y lo corto a 100 caracteres.

Tambien valido en el navegador el largo del titulo (1-120), del mensaje (1-2000) y que la imagen sea JPG/PNG de maximo 2 MB, pero eso es solo para avisarle rapido al usuario. La validacion real la hace el servidor.

## Consecuencias
- Lo bueno: aunque alguien mande HTML o script en un reporte, en el panel se ve como texto.
- El codigo queda un poco mas largo que con innerHTML.
- El token CSRF se guarda en una variable de JS, no en localStorage, y se pierde al recargar (se vuelve a pedir).
- Esto no reemplaza la CSP con Helmet ni las validaciones del servidor, las complementa.
- Depende de que index.html tenga los ids que usa app.js (form-reporte, form-login, seccion-login, panel-admin, form-buscar, buscar, lista-reportes, msg-reporte, msg-login, msg-panel, btn-salir).

## Implementacion
- Archivo modificado: public/app.js
- Prueba: enviar un reporte con titulo `<img src=x onerror=alert(1)>` y comprobar que en el panel se ve el texto tal cual. Intentar eliminar con el token borrado/alterado y ver que el servidor responde 403.
- PR: pendiente hacia develop.
