# ADR · reportRepository.js, Sentencias preparadas y funciones CRUD (MiniBuzón Seguro)

Nov 15, 2026 · @Junior Durán de la Rosa · Grupo G3 con Albert · Rama `feature/G3/Repository-Junior`

---

## ADR-001 · Cómo protegí las consultas a la base de datos contra SQL Injection

**Estado:** Aceptada. El código está en mi rama y estructurado. Falta probar la integración final con la conexión de `database.js` de Albert y que las rutas de G1 (Johansell y John) consuman mis funciones. **Decisión:** uso estricto de sentencias preparadas (prepared statements) provistas por `node:sqlite` para todas las operaciones, y un escape manual a nivel de JavaScript para los comodines en la búsqueda.

### El problema

Si se toma la entrada del usuario (como el título de un reporte o el texto de búsqueda) y se concatena directamente en una instrucción SQL, un atacante puede inyectar comillas o comandos maliciosos. Esto le permitiría saltarse validaciones, borrar la tabla completa o extraer datos que no le corresponden (SQL Injection). La validación por expresiones regulares en el servidor ayuda, pero el documento de especificación es claro: no reemplaza la separación real entre el código y los datos.

### Qué exporta `reportRepository.js`

| Función | Dónde se usa | Qué hace |
|---|---|---|
| `crearReporte(titulo, mensaje, imagen)` | `POST /api/reportes` (Johansell) | Inserta un reporte seguro y devuelve el ID automático generado |
| `listarReportes()` | `GET /api/admin/reportes` (John) | Devuelve todos los reportes ordenados por `id` descendente |
| `buscarReportes(texto)` | `GET /api/admin/reportes?buscar=` (John) | Filtra reportes por título usando `LIKE` de manera segura |
| `obtenerReporte(id)` | Descarga de imagen y borrado (John) | Busca una fila específica por su `id` exacto |
| `eliminarReporte(id)` | `DELETE /api/admin/reportes/:id` (John) | Borra un reporte por su `id` y devuelve la cantidad de filas afectadas |

### Cómo se monta

```javascript
const db = require('./database.js'); // Conexión gestionada por Albert

// Ejemplo de uso en las rutas de Express
const id = reportRepository.crearReporte(req.body.titulo, req.body.mensaje, req.body.imagen);
```

Mis funciones no manejan peticiones HTTP ni respuestas JSON, solo reciben los datos limpios de las rutas, ejecutan la consulta preparada en SQLite y devuelven el resultado.

### Decisiones

**D1. Uso exclusivo de `db.prepare()`.**
Todas mis funciones utilizan sentencias preparadas. SQLite compila la consulta primero y luego inserta los parámetros (`?`) de forma segura como datos puros. Es imposible que un parámetro cambie la estructura de la consulta.

**D2. Escape de caracteres especiales en la búsqueda.**
Para la función `buscarReportes`, el usuario puede mandar caracteres que SQL interpreta como comodines (`%` o `_`). Decidí escapar estos caracteres primero en JavaScript (`texto.replace(/%/g, '\\%')`) y usar la cláusula `ESCAPE '\'` en el `LIKE`. Así, si alguien busca literalmente el símbolo de porcentaje, la consulta no falla ni devuelve toda la tabla.

**D3. Separación del archivo de conexión.**
Yo no me encargo de abrir el archivo `.db` ni de hacer el `CREATE TABLE`. Todo eso vive en `database.js` a cargo de Albert. Mi archivo solo requiere esa conexión exportada y se dedica exclusivamente a las operaciones CRUD.

**D4. Retornos directos y útiles.**
Para que las rutas de Express puedan responder correctamente, uso `query.run().lastInsertRowid` al crear un reporte, y `query.run().changes` al eliminar. Así el router sabe exactamente si el registro se insertó o si el ID enviado para borrar realmente existía (para devolver un 404 si es 0).

### Lo que consideré y descarté

| Opción | Por qué no |
|---|---|
| Concatenación de strings con limpieza manual | Propenso a errores humanos y obsoleto. Las consultas preparadas son la defensa estándar obligatoria de OWASP y de este proyecto. |
| Usar un ORM (como Prisma o Sequelize) | Excede el alcance y la complejidad del proyecto. El documento especifica usar el módulo nativo `node:sqlite`. |
| Solo validación en Express | Limpiar el string en el router está bien, pero no es la capa de defensa principal de la BD. La BD debe protegerse a sí misma asumiendo que el dato puede venir sucio. |

### Consecuencias

- **Seguridad total contra Inyección SQL:** Los atacantes pueden enviar cualquier cadena (comillas simples, sentencias `DROP TABLE`), y SQLite simplemente lo almacenará o buscará como un texto literal inofensivo.
- **Acoplamiento controlado:** Mi código falla si el archivo `database.js` no exporta correctamente un objeto compatible con la API síncrona de `node:sqlite`.
- **Rendimiento:** Las sentencias preparadas (`db.prepare`) se podrían guardar en caché a nivel global en el módulo si el tráfico fuera masivo, pero para este caso académico, prepararlas dentro de la función garantiza que estén listas para cada ejecución sin problemas de estado.

### Lo que necesito de los demás

| Quién | Archivo | Qué necesito |
|---|---|---|
| Albert | `database.js` | Exportar la conexión síncrona de la base de datos e inicializar la tabla `reportes` antes de que mis funciones se ejecuten. |
| Johansell / John | `routes/reportes.js` y `admin.js` | Importar mi archivo y llamar a las funciones pasando los argumentos correctos (asegurándose de pasar `null` si no hay imagen al crear). |
| Rachel | `uploads.js` | Entregar a las rutas solo el nombre interno seguro de la imagen para que yo lo guarde, nunca la ruta absoluta. |

---

## ADR-002 · Cómo lo probé

**Estado:** Aceptada. **Decisión:** Probar las funciones CRUD localmente ejecutando un script de prueba contra una base de datos en memoria antes de integrarlo al servidor Express final.

### Contexto

Para evitar que un error mío tumbara el servidor de los demás, programé un pequeño archivo `test-repo.js` donde simulo la conexión de Albert usando `new Database(':memory:')`. Ejecuté todas las funciones CRUD secuencialmente para validar que SQLite respondía sin errores.

### Qué probé

| Caso | Resultado |
|---|---|
| Insertar texto normal y mensaje largo | Fila insertada, retorna `id = 1` |
| Insertar sin imagen (pasando `null`) | Fila insertada, el campo imagen queda como `NULL` en SQLite |
| Buscar con inyección SQL (`' OR 1=1 --`) | Búsqueda ejecutada, devuelve lista vacía, no afecta la BD |
| Buscar literal con caracteres (`%` y `_`) | Se escapan bien, busca literalmente esos caracteres |
| Borrar `id` existente | Devuelve `changes = 1` |
| Borrar `id` inexistente | Devuelve `changes = 0` (no explota) |

### Implementación

Archivo modificado: `reportRepository.js`. Rama: `feature/G3/Repository-Junior`. Commit: `feat(G3): añadir operaciones de base de datos seguras contra inyección SQL`. Depende de `database.js` de Albert.