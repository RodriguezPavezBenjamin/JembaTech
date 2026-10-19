# Observabilidad inicial EP2

Actualización 2026-10-19: `/api/health` ahora comprueba también el `/health` privado
de Python y publica únicamente metadatos SHA válidos de ambos servicios. Una
dependencia caída responde 503 genérico. El estado del despliegue y activación de
esta nueva comprobación están en [Railway staging](railway-staging.md). Los cortes
anteriores no se presentan como prueba de esta ampliación.

Actualizado: 2026-10-17. Instrumentación HTTP y llamadas a Python, sin plataforma APM ni métricas inventadas. No reemplaza staging ni su verificación posterior.

## Correlación

Cada solicitud HTTP a NestJS obtiene `X-Request-Id`. Si llega un UUID canónico válido se conserva (normalizado a minúsculas); si falta, contiene otros datos o aparece duplicado se genera uno aleatorio. El ID no es una credencial, prueba de identidad ni garantía de unicidad proporcionada por el cliente. No usarlo para autorizar o deduplicar operaciones.

`AsyncLocalStorage` mantiene el ID separado entre solicitudes concurrentes. Las llamadas a `/evaluate`, `/builds/preview` y procesamiento/recuperación CPU transmiten ese ID a FastAPI. Su middleware ASGI usa `ContextVar`, lo devuelve en cabecera y lo conserva también en endpoints síncronos ejecutados en el pool de hilos. No modifica los contratos de resultados de evaluación.

Nginx registra el ID validado de la respuesta upstream, no la cabecera cruda del visitante. En recursos estáticos sin backend ese campo queda vacío; no se presenta como una traza NestJS/Python.

En fuentes hay **dos identificadores distintos**: `requestId` de la petición HTTP y `runId` de la auditoría persistida. El cuerpo Python `request_id` de recuperación sigue siendo el `runId`, para validar la procedencia. Los logs de la corrida incluyen ambos. Una invocación directa del coordinador, fuera de HTTP, registra `requestId: null`; no inventa una traza web.

## Eventos y privacidad

- `http_request`: servicio, ID, método permitido, ruta plantilla, estado, duración y cierre normal/interrumpido. Nunca URL concreta, query ni parámetros de cliente.
- `python_request`: operación fija, estado, duración, confirmación `correlated` y códigos seguros `PYTHON_TIMEOUT/PYTHON_HTTP_ERROR/PYTHON_UNAVAILABLE`. No copia el error Axios, su configuración ni cabeceras.
- Eventos de fuentes: inicio/fin/fallo, IDs, cantidades y código seguro. FastAPI registra resultado de recuperación con `runId` sin lote bruto ni URL de entrada.
- NestJS usa logging JSON y un filtro global: conserva errores controlados y sus contratos, pero convierte excepciones inesperadas en 500 genérico sin publicar ni registrar SQL, stack o mensajes privados.
- FastAPI convierte excepciones inesperadas antes de iniciar respuesta en 500 genérico. Si ya se enviaron cabeceras no fabrica otro status: corta la respuesta y registra `RESPONSE_INTERRUPTED`, sin el mensaje original.
- Se desactiva el access log crudo de Uvicorn. Nginx usa JSON sin URI, query, IP o cabeceras y conserva solo errores de infraestructura de nivel crítico en su logger tradicional; los fallos HTTP/upstream quedan visibles por status en el access log seguro.

No se registran cuerpos, JWT, claves internas, contraseñas, cookies, correos, nombres ni el contenido de cotizaciones. Esta política cubre los logs personalizados de solicitudes, no una garantía sobre herramientas externas o logs futuros añadidos por otras dependencias. Los logs aún deben tener control de acceso y retención en staging.

## Métricas privadas

`GET /api/admin/observability`, documentado en Swagger. Exige JWT y rol `ADMIN`: visitante 401, cliente 403. No se agrega acceso público a métricas ni se modifica `/api/health` o `/health`.

Devuelve contadores de entrada y de llamadas a Python, agrupados por ruta plantilla/operación: `count`, `errors` (5xx o ausencia de respuesta), `clientErrors` (4xx), `aborted`, `totalMs`, `averageMs` y `maxMs`. Las duraciones usan reloj monotónico. El promedio es `totalMs / count`; no es percentil, SLA ni tiempo puro de cómputo. Python incluye red/lectura en su tiempo desde NestJS. Una desconexión antes de completar respuesta se registra como estado técnico 0, no como HTTP enviado.

Máximo 64 series por grupo y proceso, sin etiquetas por usuario/ID/query. Se reinician al reiniciar NestJS; `scope: single-process` y `resetsOnRestart: true` lo hacen explícito. No hay agregación entre réplicas ni histórico persistente. El snapshot no incluye el cierre de la propia petición de métricas, que ocurre después. La auditoría de fuentes en PostgreSQL sí persiste y es independiente.

NestJS y Python usan `durationMs`; Nginx usa `durationSeconds`. La métrica Nginx no es una medida de renderizado del navegador. La correlación verificada es HTTP entre servicios, no una traza distribuida OpenTelemetry ni medición de cada consulta SQL.

## Comprobación

Con el ambiente Compose iniciado, desde la raíz:

```bash
node --test tests/integration/observability.test.mjs
```

El worker crea dos cuentas QA temporales y una auditoría de muestra declarada; elimina solo sus propios IDs. No consulta SoloTodo ni crea cotizaciones. Comprueba permisos, UUID inválido, dos solicitudes simultáneas, correlación Nginx→NestJS→Python, JSON de métricas, error controlado 503 y validación Python 422. El proceso principal inspecciona stdout/stderr de los tres servicios y exige que ninguna marca privada del fixture esté presente. CI ejecuta esta prueba en su ambiente efímero, no contra datos de producción.

También hay pruebas unitarias de concurrencia, propagación de cabeceras, métricas acotadas, excepciones inesperadas y respuesta Python interrumpida. La revisión local se realiza con proyecto Compose `jembatech-ep2-observability`, volumen propio y proveedor externo desactivado.

## Evidencia local de este corte

- Backend: 60 pruebas aprobadas, build y lint; incluye aislamiento concurrente, errores y métricas limitadas.
- Python: 77 pruebas aprobadas, Ruff y Bandit; sin dependencias nuevas. Continúa el aviso de deprecación del cliente HTTP de tests, no fallo.
- Integración de observabilidad aprobada con 3 solicitudes correlacionadas por los tres servicios, permisos 401/403/200 y ausencia de marcas privadas en stdout/stderr.
- En ese escenario QA, las dos llamadas de preview registraron promedio 35.147 ms y máximo 45.709 ms. Es una muestra pequeña y local, no benchmark, SLA ni precisión del catálogo.
- Las 6 comprobaciones del cotizador y ambas integraciones de fuentes siguen aprobadas con las imágenes nuevas. Recuperación externa desactivada en QA y pruebas sin llamadas a SoloTodo.
- Workflow validado con actionlint; ejecución remota requiere commit/push. Los tests no se atribuyen a una revisión visual de una sesión de cliente.
- NestJS y FastAPI actualizados en el ambiente local existente, sin reiniciar PostgreSQL ni ejecutar migraciones nuevas. Proxy `4200/api/health` con base `ok`; preview sin persistir con correlación compartida y métricas sin sesión rechazadas con 401. Nginx instrumentado se probó en QA; el puerto 4200 local sigue usando el servidor de desarrollo Angular, no ese contenedor.

## Pendientes

Confirmar Actions remoto, desplegar staging, decidir retención/rotación y acceso a logs, centralización/almacenamiento de métricas y alertas para múltiples réplicas. No se comprometen APM de pago ni credenciales nuevas.

Referencias de implementación: [AsyncLocalStorage de Node](https://nodejs.org/api/async_context.html), [middleware ASGI de Starlette](https://starlette.dev/middleware/), [logger JSON de NestJS](https://docs.nestjs.com/application/logger).
