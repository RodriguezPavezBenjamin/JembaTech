# Frontend en Railway staging

El contenedor Nginx sirve Angular y reenvía `/api/` al backend por la red privada.
El navegador solo necesita el dominio público del frontend; Postgres y Python no
necesitan dominios públicos. No se incluyen credenciales en el frontend.

## Variables y despliegue

Crear un servicio `frontend` en el proyecto **JembaTech Staging**, entorno
**staging**, conectado a `RodriguezPavezBenjamin/JembaTech`, rama `main`:

- Root Directory: `/frontend`.
- Wait for CI: activado.
- Dockerfile existente, sin comandos de build/start personalizados ni pre-deploy.
- Variables (referencias a un servicio llamado exactamente `backend`):

```dotenv
PORT=80
BACKEND_HOST=${{backend.RAILWAY_PRIVATE_DOMAIN}}
BACKEND_PORT=${{backend.PORT}}
```

Healthcheck Path: `/api/health` (comprueba también backend y base de datos).
Después de publicar este cambio y de completar CI, desplegar el servicio.
En Settings → Networking → Generate Domain, usar el puerto **80**. Comprobar
la portada, una ruta Angular y `/api/health` desde ese dominio. Estos pasos son
instrucciones pendientes de validar en Railway, no evidencia de despliegue.

## Compatibilidad y DNS

Sin variables adicionales, la imagen conserva `backend:3000` y escucha en `80`,
por lo que Docker Compose no necesita cambios. El entrypoint de la imagen oficial
Nginx transforma `nginx.conf` (plantilla) en `/etc/nginx/conf.d/default.conf` al
arrancar. El filtro limita la sustitución a las variables de despliegue, preservando
`$host`, `$uri`, los encabezados y los campos de correlación del log.

El upstream usa resolución DNS renovable y los resolvers de `/etc/resolv.conf`
del contenedor, sin fijar IPs de Docker o Railway. Así puede seguir un cambio de IP
del backend sin reconstruir la imagen ni reiniciar Nginx. No se elimina `/api/`
al reenviar la solicitud. No se registra la URI, query ni credenciales en el log JSON.

Referencias: [plantillas de la imagen oficial Nginx](https://hub.docker.com/_/nginx),
[upstreams y resolución DNS de Nginx](https://nginx.org/en/docs/http/ngx_http_upstream_module.html#resolve),
[red privada de Railway](https://docs.railway.com/networking/private-networking).

## Verificación reproducible

Desde la raíz del repositorio, con Docker disponible:

```powershell
node --test tests/integration/frontend-proxy-config.test.mjs tests/integration/ci-policy.test.mjs
docker build -t jembatech-frontend-railway-qa:local ./frontend
$env:TEST_FRONTEND_IMAGE = 'jembatech-frontend-railway-qa:local'
node --test tests/integration/frontend-proxy.test.mjs
Remove-Item Env:TEST_FRONTEND_IMAGE
```

La prueba Docker crea y retira únicamente su red y contenedores con nombres
aleatorios, sin montar volúmenes ni conectarse a cuentas/datos reales. Comprueba
valores locales, host/puertos personalizados, rutas SPA, prefijo y query de API,
encabezado de correlación, logs sin query y recuperación después de un cambio real
de IP del upstream. No sustituye una prueba funcional de staging con el backend real.
CI ejecuta el contrato estático y la prueba Docker con la imagen recién construida.

Validación local del cambio (2026-10-18): imagen frontend construida correctamente;
60 pruebas Node de contratos, seguridad y documento aprobadas; prueba Docker del
proxy aprobada, incluido cambio forzado de IP; `actionlint` y `git diff --check`
sin errores. Una primera ejecución restringida bloqueó la conexión loopback de
la prueba de salud; la repetición con permisos de red local aprobó. No se ha
desplegado el frontend en Railway ni validado todavía el dominio público.
