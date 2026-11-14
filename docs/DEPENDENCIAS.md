# Dependencias y por que existen

| Dependencia | Version | Uso | Responsable |
|---|---|---|---|
| Node.js | 24.x | runtime, sqlite/crypto/fs nativos | Todos |
| express | 5.3.0 | servidor, rutas | Jorge / G1 |
| express-session | 1.19.0 | cookie y estado de sesion | Angel / Jorge |
| multer | 2.5.0 | multipart y limites de subida | Rachel |
| sharp | 0.35.5 | verificar y re-codificar imagenes | Rachel |
| helmet | 8.3.0 | cabeceras HTTP defensivas | Jorge |

Dependencias nativas: `node:sqlite`, `node:crypto`, `node:fs`, `node:path`. No requieren instalacion.

Ejecutar `npm install` desde la raiz para descargar paquetes y generar `package-lock.json`.
No anadir nuevas dependencias sin aprobarlas con Jorge.
