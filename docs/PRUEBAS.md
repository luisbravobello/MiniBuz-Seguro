# Pruebas de seguridad requeridas

- [ ] Reporte valido se guarda en SQLite.
- [ ] Buscar texto de inyeccion SQL no altera la consulta.
- [ ] XSS en titulo/mensaje se presenta como texto, no se ejecuta.
- [ ] Admin sin sesion no puede listar ni eliminar.
- [ ] DELETE sin token CSRF devuelve 403.
- [ ] DELETE con token invalido devuelve 403.
- [ ] JPEG y PNG reales, dentro del limite, son aceptados.
- [ ] Archivo renombrado falsamente .png se rechaza.
- [ ] Archivo superior a 2 MiB se rechaza.
- [ ] Solo el admin autenticado puede consultar imagen privada.
- [ ] La demo funciona desde otro equipo en la red local autorizada.
