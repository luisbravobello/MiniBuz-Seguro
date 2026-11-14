# Contratos internos definitivos

Los nombres de metodos son orientativos: acuerden sus exportaciones antes de crear los PR.

- `POST /api/reportes`: Johansell. Publico. `multipart/form-data`: titulo, mensaje, imagen?.
- `POST /api/admin/login`: Angel. Publico, comprueba secreto de admin y crea sesion.
- `GET /api/admin/session`: Angel. Confirma autenticacion.
- `GET /api/admin/csrf`: Luis. Emite token de la sesion autenticada.
- `POST /api/admin/logout`: Angel + Luis. Sesion + CSRF.
- `GET /api/admin/reportes?buscar=...`: John. Sesion admin.
- `DELETE /api/admin/reportes/:id`: John. Sesion admin + token CSRF.
- `GET /api/admin/reportes/:id/imagen`: John. Sesion admin; responde imagen privada.

**Dependencias de modulos**
- G1 llama a G3 (repo), G4 (auth/CSRF) y G5 (uploads).
- G2 consume rutas de G1/G4 y envía token CSRF en X-CSRF-Token.
- G3 utiliza node:sqlite.
- G5 registra middlewares y monta routers, maneja errores.

**Requisitos de seguridad**
- Nunca concatenar entradas dentro del SQL.
- Mostrar titulos/mensajes con textContent, no innerHTML.
- Cookie HttpOnly/SameSite, token CSRF por sesion en cambios sensibles.
- JPEG/PNG de maximo 2 MiB, decodificar y normalizar, fuera de public.
