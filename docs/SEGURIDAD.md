# Alcance y limitaciones de seguridad

**SQL Injection:** parametros vinculados y sentencias preparadas.
**XSS:** nunca insertar texto no confiable con innerHTML.
**CSRF:** token sincronizador por sesion, cabecera X-CSRF-Token; SameSite y Origin check complementarios.
**Subida de archivos:** solo JPG/PNG, 2 MiB, un archivo, decodificar y normalizar con sharp, nombre generado, carpeta privada.

Limitaciones: HTTP sobre LAN no cifra el trafico. Usar cuentas ficticias en red controlada. MemoryStore solo para una demo local con un proceso.
