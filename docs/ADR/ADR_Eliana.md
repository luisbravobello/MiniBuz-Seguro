# ADR - Eliana

**Grupo:** G2  
**Tema sugerido:** Pagina unica y estilos  
**Rama:** feature/G2/Frontend-Eliana  
**Fecha:** 16/11/2026

## Contexto
Me toco public/index.html y public/styles.css. Todo tiene que estar en una sola pantalla: el formulario publico para enviar reportes, el login del admin y el panel donde se listan, buscan y eliminan. La logica la hace app.js (Alejandro), asi que el HTML tenia que tener los ids y clases que el usa, y no podia tener nada que rompa la CSP de Helmet.

## Alternativas consideradas
- Hacer varias paginas (inicio, login, panel). Queda mas ordenado pero el proyecto pide una sola pantalla y app.js ya esta pensado para eso.
- Usar Bootstrap u otra libreria de CSS desde un CDN. Es mas rapido pero hay que abrir la CSP a otro dominio y agrega una dependencia que no necesitamos.
- Una sola pagina con CSS propio y el panel oculto con `hidden` hasta que haya sesion.

## Decision
Elegi la ultima. El HTML tiene tres secciones: nuevo reporte, `seccion-login` y `panel-admin` (con `hidden`). app.js cambia cual se ve segun la sesion.

No hay scripts ni estilos en linea, solo `app.js` y `styles.css`, para que la CSP pueda quedar en `'self'`. Los campos tienen `maxlength` igual a los limites del servidor (titulo 120, mensaje 2000, busqueda 100) y el input de imagen acepta solo JPG/PNG. Eso es solo ayuda para el usuario, la validacion real esta en el servidor.

Los estilos son simples: tarjetas, una columna, modo oscuro automatico y en celular los botones ocupan todo el ancho. Los mensajes usan las clases `msg ok` y `msg error` que pone app.js, y el texto de los reportes usa `pre-wrap` y `overflow-wrap` para que un titulo muy largo no rompa la pagina.

## Consecuencias
- Ocultar el panel con `hidden` no es seguridad, solo es visual. Las rutas de admin tienen que validar la sesion.
- Si alguien cambia un id en el HTML, app.js deja de funcionar, hay que coordinar cualquier cambio con Alejandro.
- Sin librerias externas la pagina carga rapido y no hay que tocar la CSP.
- El texto de los reportes se muestra con textContent desde app.js; el CSS no ayuda contra XSS, solo con el formato.

## Implementacion
- Archivos: public/index.html, public/styles.css
- Ids que usa app.js: form-reporte, msg-reporte, seccion-login, form-login, msg-login, panel-admin, form-buscar, buscar, msg-panel, lista-reportes, btn-salir.
- Prueba: probar la pagina en computadora y celular, enviar un reporte con `<script>alert(1)</script>` en el titulo y ver que en el panel sale como texto.
- PR: pendiente hacia develop.
