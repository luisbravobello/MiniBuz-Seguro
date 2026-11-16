# ADR - G5 - Integracion del servidor web

- **Autor:** Jorge
- **Proyecto:** MiniBuzon Seguro
- **Rama:** `feature/G5/Server-Jorge`
- **Fecha:** 16 de noviembre de 2026
- **Estado:** Propuesta implementada; pruebas de integracion pendientes.

## Contexto

El proyecto es una aplicacion pequena en Node.js que funciona en localhost y una red local autorizada. Cada pareja implementa un modulo diferente. Hacia falta un punto de entrada unico que conectara la web, las sesiones, las rutas, SQLite y los controles basicos sin duplicar el codigo de otros integrantes.

## Decision

Utilizar `server.js` como punto de entrada con Express. Servir solo `public/`; configurar Helmet, sesiones administrativas mediante `express-session` y cookies HttpOnly/SameSite=Lax; registrar autenticacion y CSRF del G4; montar las rutas de G1 y abrir SQLite antes de escuchar peticiones. El servidor escuchara el puerto configurable (3000 por defecto) y la direccion configurada en `HOST`. Manejar errores sin enviar trazas internas y cerrar SQLite al finalizar.

## Alternativas descartadas

Crear una API separada o cambiar a ASP.NET Core agregaria mas archivos y configuracion. Publicar todo el directorio del repositorio expondria archivos sensibles. Guardar claves en el codigo o usar credenciales de ejemplo seria inseguro.

## Consecuencias

La integracion queda concentrada en un archivo y es mas facil de explicar. Los modulos de cada pareja mantienen su responsabilidad. Como limite, las sesiones usan MemoryStore y el trafico por HTTP local no esta cifrado, por lo que el sistema es solo para demostracion sobre una LAN controlada.

## Implementacion

Archivos propios: `server.js` y `scripts/generar-hash-admin.js`. Se detecto una diferencia temporal de nombre entre `validarCsrf` y `verificarCsrf`, documentada para que John la corrija. 
