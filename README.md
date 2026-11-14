# MiniBuzón Seguro

Sistema de reportes con **cuatro protecciones de seguridad web**: SQL Injection, XSS, CSRF y archivos adjuntos maliciosos. Proyecto universitario (Tecnología del Internet) desarrollado por 5 parejas / 10 integrantes.

> **Estado:** estructura inicial. Cada archivo contiene un comentario `TODO` con su responsable; todavía no hay código funcional.

## ¿Qué hace?

- Cualquier persona envía un reporte con **título** (1-120), **mensaje** (1-2000) e **imagen opcional** (JPG/PNG, máx. 2 MiB).
- Una cuenta **administradora** inicia sesión, lista y busca reportes por título, ve las imágenes y elimina reportes.
- Corre en `localhost:3000` y en la IP local para pruebas autorizadas en LAN.

## Tecnologías

| Pieza | Versión | Uso |
|---|---|---|
| Node.js | 24.x LTS | Runtime; incluye `node:sqlite`, `node:crypto` |
| express | 5.3.0 | Servidor HTTP y rutas |
| express-session | 1.19.0 | Sesión administrativa (MemoryStore, solo demo) |
| multer | 2.5.0 | Recibir `multipart/form-data` |
| sharp | 0.35.5 | Decodificar y re-codificar imágenes |
| helmet | 8.3.0 | Cabeceras defensivas y CSP |

SQLite se usa mediante el módulo nativo `node:sqlite`, con una única tabla `reportes` (`id`, `titulo`, `mensaje`, `imagen`, `fecha`).

## Estructura

```
MiniBuzonSeguro/
├── server.js              # Jorge
├── database.js            # Albert
├── reportRepository.js    # Junior
├── auth.js                # Angel
├── csrf.js                # Luis
├── uploads.js             # Rachel
├── routes/
│   ├── reportes.js        # Johansell
│   └── admin.js           # John
├── public/
│   ├── index.html         # Eliana
│   ├── styles.css         # Eliana
│   └── app.js             # Alejandro
├── database/schema.sql    # plantilla de Albert
├── data/                  # .db local (ignorado)
├── private-uploads/       # imágenes (ignoradas)
└── docs/                  # PDFs, ADR, pruebas, seguridad, ramas
```

## Rutas HTTP

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/api/reportes` | Público (multipart: titulo, mensaje, imagen?) |
| POST | `/api/admin/login` | Público |
| GET | `/api/admin/session` | Admin |
| GET | `/api/admin/csrf` | Admin |
| POST | `/api/admin/logout` | Admin + CSRF |
| GET | `/api/admin/reportes?buscar=` | Admin |
| DELETE | `/api/admin/reportes/:id` | Admin + CSRF |
| GET | `/api/admin/reportes/:id/imagen` | Admin |

## Equipo y ramas

| Grupo | Integrante | Archivos | Rama |
|---|---|---|---|
| G1 | Johansell | `routes/reportes.js` | `feature/G1/Reportes-Johansell` |
| G1 | John | `routes/admin.js` | `feature/G1/Admin-John` |
| G2 | Eliana | `public/index.html`, `public/styles.css` | `feature/G2/Frontend-Eliana` |
| G2 | Alejandro | `public/app.js` | `feature/G2/JavaScript-Alejandro` |
| G3 | Albert | `database.js` | `feature/G3/Database-Albert` |
| G3 | Junior | `reportRepository.js` | `feature/G3/Repository-Junior` |
| G4 | Angel | `auth.js` | `feature/G4/Auth-Angel` |
| G4 | Luis | `csrf.js` | `feature/G4/CSRF-Luis` |
| G5 | Jorge | `server.js` | `feature/G5/Server-Jorge` |
| G5 | Rachel | `uploads.js` | `feature/G5/Uploads-Rachel` |

Flujo de trabajo:

1. Cada integrante trabaja **solo en su rama** `feature/Gx/...` (salen de `develop`).
2. Se abre un Pull Request hacia `develop` explicando qué archivo cambió, cómo probarlo y de quién depende.
3. **Solo Jorge** fusiona a `develop`. `main` se actualiza únicamente con una versión estable aprobada para la demostración.
4. Cada integrante entrega además su ADR en `docs/ADR/`.

## Preparar el entorno

```bash
node --version      # debe ser 24.x
npm install         # requiere internet; genera package-lock.json
cp .env.example .env
npm start           # solo funciona cuando Jorge integre server.js
```

Variables de `.env` (nunca se versiona):

| Variable | Uso |
|---|---|
| `PORT` | Puerto local, normalmente 3000 |
| `HOST` | `0.0.0.0` para acceso desde LAN |
| `SESSION_SECRET` | Secreto largo y aleatorio para la sesión |
| `ADMIN_PASSWORD_HASH` | Hash scrypt del administrador (nunca la contraseña en texto) |
| `NODE_ENV` | `development` para la demostración |

## Seguridad

| Riesgo | Defensa |
|---|---|
| SQL Injection | Sentencias preparadas con parámetros; nunca concatenar `buscar` |
| XSS | `textContent` en vez de `innerHTML`; CSP con Helmet |
| CSRF | Token por sesión en `X-CSRF-Token`; cookie HttpOnly + SameSite=Lax |
| Archivos maliciosos | 1 JPG/PNG ≤ 2 MiB; Sharp re-encode; nombre aleatorio; carpeta privada |

Limitaciones: HTTP en LAN no cifra el tráfico (usar cuentas ficticias en red controlada) y MemoryStore pierde las sesiones al reiniciar. Detalle en `docs/SEGURIDAD.md`; lista de pruebas en `docs/PRUEBAS.md`.

## Qué no se sube a Git

`.env`, `data/*.db*`, `private-uploads/*`, `node_modules/`. El `package-lock.json` real sí se versiona (lo sube Jorge tras `npm install`).

## Documentación

- `docs/MiniBuzonSeguro_Especificacion_Proyecto.pdf`
- `docs/MiniBuzonSeguro_Base_de_Datos.pdf`
- `docs/DEPENDENCIAS.md`, `docs/GIT_Ramas.md`, `docs/SEGURIDAD.md`, `docs/PRUEBAS.md`, `docs/ADR/`
