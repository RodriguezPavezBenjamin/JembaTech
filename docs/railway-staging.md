# Railway staging: despliegue, salud y adopción

## Estado real, 2026-10-19

- URL: https://jembatech.up.railway.app, proyecto JembaTech Staging, entorno staging.
- Cuatro servicios existentes: frontend, backend, python-service y Postgres con
  postgres-volume. Solo frontend necesita acceso HTTP público.
- El usuario confirmó Google, rol ADMIN y solicitud CLIENT → respuesta ADMIN →
  seguimiento CLIENT. [CI EP2 #13](https://github.com/RodriguezPavezBenjamin/JembaTech/actions/runs/39194834022)
  para `1a1279b`: success confirmado también por API GitHub en esta revisión.
- Automatización activada: el artifact `deployment.json` aportado por el usuario
  registra success el 2026-10-19T04:12:12.757Z para
  `c4dd5dd767c3a9dfd78c87ff196ab85fca619dba`, con salud frontend/backend/Python/base
  correcta y el mismo SHA. [CI del commit](https://github.com/RodriguezPavezBenjamin/JembaTech/actions/runs/39197974002).
- [Adopción real Terraform](adopcion-railway-evidencia.md): 16 objetos importados,
  plan sin cambios ni diferencias observadas y archivos cifrados, confirmado por
  el propietario. No se ha ejecutado apply, creado duplicados ni cambiado planes
  de pago. Revocación del token temporal confirmada por el propietario; el token
  de CD se conserva.
- Revisión pública de solo lectura repetida durante el cierre: portada, versión
  y salud de frontend/backend/Python/base correctos para `c4dd5dd`. No equivale a
  una nueva comprobación del panel administrativo ni a desplegar cambios locales.

## Automatización posterior a CI

`.github/workflows/staging.yml` se ejecuta al terminar **CI EP2**, solamente para
un push exitoso a main del repositorio original. Un PR, fork o CI fallida no lo
habilitan. Checkout usa el SHA de ese push aprobado, no artifacts de otros jobs ni
la última versión potencialmente no validada de main. El script vuelve a consultar
la API GitHub para comprobar workflow, repo, evento, branch, conclusión, SHA y
que siga siendo la punta de main antes de hacer un despliegue.

Esto evita esperar el deploy dentro del mismo CI al que Railway está esperando.
Los workflows se mantienen separados y los gates existentes no se relajan.

`scripts/deploy-staging.mjs`:

1. Valida el token de proyecto: solo proyecto conocido y entorno staging.
2. Descubre por nombre los servicios sin pedir ni registrar valores de variables.
3. Comprueba roots, repo, healthchecks, comando de migración y dominios HTTP.
4. Reutiliza los autodeploys del mismo SHA. Si falta uno, usa la mutación oficial
   `serviceInstanceDeployV2` con commitSha explícito, en orden Python/backend/frontend.
   **Nunca despliega Postgres**, reinicia servicios por error ni cambia variables.
5. Espera SUCCESS activo del deployment exacto. Fallos, aprobación pendiente,
   sustitución por otro commit o rate limit hacen fallar la verificación.
6. Comprueba portada, `/version.json` y `/api/health` por HTTPS, sin autenticación,
   con timeouts, sin seguir redirecciones ni enviar el token Railway a la web.
7. Publica artifact sanitizado `staging-evidence`: SHA, run CI, IDs/estado y salud.
   No incluye payloads GraphQL, logs de usuarios, variables, contraseñas o tokens.

El presupuesto de peticiones API es limitado (máximo 60); espera de 30 segundos
entre lecturas pendientes. 429 detiene el proceso: revisar Retry-After antes de
reintentar, sin repetir mutaciones de resultado incierto. No es monitoreo recurrente.

## Activación ya realizada: referencia para reproducir, sin compartir claves

1. En Railway → **Project Settings → Tokens**, el propietario crea un token del
   proyecto **JembaTech Staging**, limitado al entorno **staging**.
2. En GitHub del repositorio → **Settings → Environments → staging**, crear/configurar
   el entorno de Actions y permitir despliegues solo desde main. No añadir esperas
   manuales si se necesita despliegue completamente automático.
3. Guardar el token como **Environment Secret `RAILWAY_STAGING_TOKEN`**. No es una
   variable del servicio backend ni un secreto Firebase. No pegarlo en el chat,
   tfvars, workflow, terminal compartida o commit. No usar un token de cuenta amplio.
4. Revisar que las fuentes de los tres servicios siguen conectadas al repo/rama
   main y que Wait for CI está activado. Se reutiliza el autodeploy existente para
   evitar builds duplicados; no es necesario desconectar nada.
5. Confirmar los healthchecks de la tabla. Si CD denuncia deriva, detenerse y
   contrastar los valores: no desactivar la validación para conseguir verde.
6. Publicar este cambio. Esperar CI y después **Railway staging**. El primer run
   debe construir las imágenes nuevas antes de validar versiones; un despliegue
   antiguo no se acepta aunque devuelva 200.
7. Conservar el artifact y comprobar el flujo humano en esa versión. Solo entonces
   registrar SHA desplegado y crear la release EP2 por decisión del propietario.

## Configuración existente que debe conservarse

| Servicio | Root | Puerto | Healthcheck | Pre-deploy |
| --- | --- | --- | --- | --- |
| python-service | /python-service | 8000 | /health | ninguno |
| backend | /backend | 3000 | /api/health | node node_modules/prisma/build/index.js migrate deploy |
| frontend | /frontend | 80 | /api/health | ninguno |
| Postgres | imagen existente | interno | gestionado por la base | ninguno |

Variables no sensibles: PORT, NODE_ENV=production en backend, flag SoloTodo=false,
DATABASE_URL por referencia a Postgres, PYTHON_SERVICE_URL por red privada y
BACKEND_HOST/BACKEND_PORT en frontend. Firebase y JWT permanecen en backend, con
los valores ya configurados. No rotarlos ni copiarlos para activar este workflow.
El entorno Railway es staging aunque NODE_ENV sea production.

## Salud y versión

- Frontend: el Dockerfile recibe ARG `RAILWAY_GIT_COMMIT_SHA` en su build y escribe
  `/version.json` con únicamente servicio y SHA. Nginx evita caché/fallback SPA en
  esa ruta. No incluye fecha de build, API key ni variables completas.
- Python: `/health` devuelve su estado, nombre de servicio y SHA válido, o `local`.
- NestJS: `/api/health` ejecuta SELECT 1 y consulta el `/health` privado de Python
  con timeout de tres segundos. Responde estado, SHA de backend y SHA de Python.
  Una dependencia caída produce 503 genérico, sin URLs internas ni errores SQL.
- CD exige el mismo SHA completo en los tres servicios y el metadato de Railway.
  `local`, versión antigua o falta de metadatos NO se convierten en éxito.

Comprobar esta cadena no valida Google ni datos de negocio por sí solo; las
pruebas funcionales manuales son evidencia separada. Python sigue privado.

## Terraform y estado

El módulo real está en [infra/railway](../infra/railway/README.md). El módulo raíz
de infra conserva el manifiesto EP1 histórico. CI valida el módulo Railway y
ejecuta un plan **simulado** sin credenciales; no confundirlo con adopción real.

El propietario autorizó una credencial temporal de workspace y confirmó los
imports y el plan real sin cambios sobre las 16 direcciones esperadas. Respaldo
recuperable y estado EFS preparados. [Resultado y alcance](adopcion-railway-evidencia.md).
`plan-railway-adoption.mjs` no acepta planes parciales ni escrituras propuestas.
No hay workflow de apply/destroy ni se envía el estado como artifact. Las opciones
no soportadas por el proveedor siguen como limitación de reproducibilidad; no
confundir la adopción real con aprovisionamiento completo desde cero.

## Rollback básico, controlado

1. Guardar el SHA/deployment saludable y una copia recuperable de la base antes de
   cambios incompatibles. El volumen persistente por sí solo no es un backup.
2. Si falla CD, no anunciar versión válida, no generar tag/release y revisar el
   código seguro de error y el deployment en Railway sin publicar sus secretos.
3. El propietario puede seleccionar un deployment anterior con rollback disponible
   en cada servicio, siguiendo compatibilidad de Python/backend/frontend. No usar
   un endpoint público de rollback ni automatizar la vuelta a una versión vulnerable.
4. Una migración Prisma ya aplicada NO se revierte al volver de imagen. Comprobar
   compatibilidad y preparar corrección o restauración acordada antes de actuar.
5. Repetir salud y el flujo cliente/admin sobre el conjunto restaurado. Registrar
   los SHAs realmente servidos; un rollback no tiene por qué coincidir con main.

## Verificación local histórica de la preparación

Resultados locales de esta preparación, 2026-10-19:

- Backend: 168 pruebas en 15 suites, build y lint aprobados.
- Python: 201 pruebas y Ruff aprobados en imagen QA sin red. Un aviso previo de
  deprecación de TestClient no bloqueante. Se normalizó el permiso Linux de los
  `.py` solo dentro de la imagen QA por el montaje Windows; no se excluyeron reglas.
- Contratos Node: 36 pruebas aprobadas (25 nuevas de staging/adopción y 11 de
  compatibilidad/política/proxy). Acción de deploy simulada, sin tokens reales.
- Terraform 1.16.4: fmt, validate y un plan mock aprobados, sin red. Lock del
  proveedor 0.6.2 con checksums Linux/Windows. No se ejecutó un plan autenticado.
- actionlint aprobó ambos workflows, sin ShellCheck/Pyflakes adicionales.
- Imágenes frontend/backend/Python construidas. Stack QA independiente con
  PostgreSQL temporal en RAM: migraciones, proxy, SQL, Python y tres SHAs iguales
  aprobados; detener solo su Python produjo 503; al arrancarlo recuperó salud.
  El puerto host aleatorio de Python se redescubrió después del reinicio. El
  primer intento de la prueba no lo hacía y falló; no fue un fallo de staging.
- Contenedores/red QA retirados; tres contenedores originales preservados.
- TruffleHog fijado por digest: cero hallazgos en copia aislada de los 29 archivos
  modificados/nuevos antes de este registro. No es un escaneo Git del commit futuro.
- Trivy: tres imágenes nuevas aprobaron todos los CRITICAL y HIGH con parche;
  informes completos en `reports/security/staging-20261019`, ignorados. No se
  afirma ausencia total de vulnerabilidades ni se repitió aquí CodeQL remoto.

Estos resultados locales históricos no constituían por sí solos una ejecución
cloud; la ejecución real posterior se registra al inicio de este documento.
Los cambios locales posteriores de adopción/documentación todavía necesitan su
propio commit y CI/CD. No atribuirles automáticamente la aprobación de `c4dd5dd`.

Referencias: [API y token por proyecto](https://docs.railway.com/integrations/api),
[despliegues API](https://docs.railway.com/integrations/api/manage-deployments),
[Wait for CI](https://docs.railway.com/deployments/github-autodeploys),
[ARG Dockerfile](https://docs.railway.com/builds/dockerfiles),
[metadatos Git](https://docs.railway.com/variables/reference).
