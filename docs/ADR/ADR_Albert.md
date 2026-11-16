# ADR - Albert

**Grupo:** G3  
**Tema:** Seleccion de SQLite y esquema minimo  
**Rama:** `feature/G3/Database-Albert`  
**Fecha:** 15 de noviembre de 2026  
**Estado:** Aceptado

## Contexto
MiniBuzon Seguro necesita guardar reportes (titulo, mensaje, imagen opcional y fecha) para una demostracion local y en LAN. El sistema la usan un formulario publico y un solo administrador. Hacia falta un almacenamiento que:

- funcionara sin instalar ni administrar un servidor de base de datos;
- permitiera consultas preparadas, para defender contra SQL Injection;
- no se pudiera leer desde el navegador ni subir a GitHub por accidente;
- se mantuviera minimo: una sola tabla y sin datos de autenticacion.

## Alternativas consideradas
| Alternativa | Ventajas | Por que se descarto |
|---|---|---|
| Supabase / PostgreSQL | Robusto, multiusuario | Requiere servicio externo e internet; el proyecto lo excluye explicitamente |
| Paquete npm `better-sqlite3` / `sqlite3` | Maduro, muy usado | Dependencia nativa adicional; Node 24 ya trae `node:sqlite` |
| Archivo JSON | Muy simple | Sin transacciones, sin restricciones ni consultas parametrizadas; riesgo de corrupcion con escrituras concurrentes |
| **`node:sqlite` (SQLite integrado)** | Sin dependencias, sentencias preparadas, restricciones `CHECK`, un archivo local | **Elegida** |

## Decision
Use **SQLite mediante el modulo nativo `node:sqlite`**, con una sola tabla `reportes` en `data/minibuzon.db`.

### Esquema
Esta en `database/esquema.js` (constante `ESQUEMA_SQL`) y es idempotente con `IF NOT EXISTS`. `database/schema.sql` es una copia de referencia, totalmente comentada y generada automaticamente.

| Columna | Tipo | Regla |
|---|---|---|
| `id` | INTEGER | `PRIMARY KEY AUTOINCREMENT`; el cliente nunca lo envia y no se reutiliza |
| `titulo` | TEXT | `NOT NULL`, 1-120 caracteres reales (`CHECK length(trim())`) |
| `mensaje` | TEXT | `NOT NULL`, 1-2000 caracteres reales |
| `imagen` | TEXT | `NULL` o solo nombre interno: `[A-Za-z0-9._-]`, sin `..`, terminado en `.jpg`, `.jpeg` o `.png` |
| `fecha` | TEXT | `DEFAULT datetime('now')` (UTC) con `CHECK` de formato |

### Arquitectura de la capa de datos (SOLID)
`database.js` es una **fachada**: el resto del equipo solo importa ese archivo. La logica interna esta separada por responsabilidad:

| Modulo | Responsabilidad unica |
|---|---|
| `database/config.js` | Rutas y tiempos; solo valores, sin logica |
| `database/esquema.js` | Definicion de la tabla y `aplicarEsquema()` en una transaccion |
| `database/configuracionSqlite.js` | PRAGMAs de seguridad |
| `database/conexion.js` | Abrir, configurar, aplicar el esquema y verificar integridad de una conexion |
| `database/respaldo.js` | Copia consistente con `VACUUM INTO` |
| `database.js` | Conexion unica del proceso; API publica |

Como se aplica cada principio:

- **S (responsabilidad unica):** cada modulo tiene una sola razon para cambiar. Por ejemplo, un cambio de PRAGMA solo toca `configuracionSqlite.js`.
- **O (abierto/cerrado):** el esquema lleva una version (`PRAGMA user_version`). Para crecer se agrega una migracion sin modificar `conexion.js`.
- **L (sustitucion de Liskov):** `abrirBaseDeDatos()` devuelve siempre un `DatabaseSync` igual de configurado, ya sea un archivo o `:memory:`. El repositorio funciona con cualquiera de los dos.
- **I (segregacion de interfaces):** `database.js` expone solo lo que cada consumidor necesita:
  - Junior usa `obtenerDb()`;
  - Jorge usa `inicializarBaseDeDatos()` y `cerrarBaseDeDatos()`.
- **D (inversion de dependencias):** `abrirBaseDeDatos(ruta, { configurar, crearEsquema, ... })` recibe sus dependencias por parametro. Las pruebas inyectan una ruta temporal o una configuracion que falla, sin modificar el codigo.

### Endurecimiento
- **Tabla `STRICT`:** SQLite rechaza tipos incorrectos en vez de convertirlos.
- **Indice unico parcial en `imagen`:** un archivo pertenece a un solo reporte, asi que borrar uno no elimina la imagen de otro.
- **PRAGMAs al abrir la conexion:**
  - `foreign_keys = ON`;
  - `journal_mode = WAL` y `synchronous = NORMAL`;
  - `busy_timeout = 5000`;
  - `trusted_schema = OFF`, `secure_delete = ON` y modo defensivo;
  - extensiones deshabilitadas y comillas dobles solo como identificadores.
- **Valores dentro de PRAGMA:** como PRAGMA no admite parametros `?`, los valores numericos se validan con `Number.isSafeInteger`. Rechazan, por ejemplo, `'5; DROP'`.
- **Ubicacion protegida:** la BD vive en `data/` fuera de `public/` (el codigo se niega a abrirla dentro de `public/`) y `.gitignore` excluye `*.db`, `*.db-wal` y `*.db-shm`.
- **Mensajes de error genericos:** no se revelan rutas internas.

## Consecuencias
**Positivas**
- La app corre con `npm install` + Node 24, sin otro servidor de BD.
- La BD es la ultima barrera: aunque el frontend o una ruta omitan una validacion, SQLite rechaza titulos vacios, textos excesivos, tipos incorrectos y rutas de archivo maliciosas.
- Las consultas de `reportRepository.js` usan `db.prepare(...)` con parametros `?`. Un `prepare()` compila una sola instruccion, por lo que no se pueden apilar sentencias.
- Cada pieza se prueba por separado.

**Limitaciones y riesgos**
- SQLite admite un solo escritor a la vez; es suficiente para la demo, no para produccion.
- No se debe poner el `.db` en una carpeta de red compartida: WAL necesita un disco local. Lo comprobe cuando la BD fallo con "disk I/O error" en una carpeta montada.
- Copiar el `.db` a mano con WAL activo puede dar un respaldo incompleto; usar `crearRespaldo()`.
- La BD y la carpeta `private-uploads/` no comparten transaccion: las rutas deben coordinar alta y baja de imagenes (responsabilidad de G1 y G5).
- `node:sqlite` muestra un aviso "experimental" en algunas versiones de Node.
- Visual Studio analiza los `.sql` como SQL Server. Por eso el esquema ejecutable vive en `esquema.js` y `schema.sql` queda comentado.

## Implementacion
**Archivos**

| Archivo | Contenido |
|---|---|
| `database.js` | Fachada: `obtenerDb`, `inicializarBaseDeDatos`, `cerrarBaseDeDatos`, `crearRespaldo`, `abrirBaseDeDatos` |
| `database/config.js`, `esquema.js`, `configuracionSqlite.js`, `conexion.js`, `respaldo.js` | Modulos internos descritos en la tabla de arquitectura |
| `database/schema.sql` | Copia de referencia; se regenera con `node database/generarSchemaSql.js` |
| `database/database.test.js` | 23 pruebas automatizadas |

**Prueba**

```
node --test database/database.test.js
```

Las 23 pruebas cubren el plan de la seccion 6 del PDF de BD:

- insercion valida con fecha automatica;
- titulo vacio o con solo espacios;
- limites 120/121 y 2000/2001;
- reporte sin imagen;
- 13 nombres de imagen maliciosos;
- busqueda literal con `%`, `_` y comillas;
- intentos de SQL Injection (`' OR 1=1`, `UNION`, `DROP`);
- borrado de un id inexistente (0 filas);
- PRAGMAs de seguridad activos.

Ademas cubren cada modulo por separado: version del esquema, validacion estricta del timeout, error generico al fallar (DIP), BD en memoria y respaldo legible.

Resultado: 23/23 en Node 22 y 24.

**Contrato para el equipo**
- **Junior** (`reportRepository.js`): `const { obtenerDb } = require('./database')` y siempre `db.prepare('... ?')`.
- **Jorge** (`server.js`): llamar `inicializarBaseDeDatos()` al arrancar y `cerrarBaseDeDatos()` en SIGINT/SIGTERM.

**Pull Request:** `feature/G3/Database-Albert` → `develop` (lo fusiona Jorge).
