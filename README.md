# JembaTech

Aplicación multiplataforma para cotizar PC, elegir presets y recibir una revisión explicable de compatibilidad, capacidades, consumo y precios estimados. El puntaje orienta sobre reglas de referencia; no mide FPS ni certifica rendimiento o compatibilidad final.

## Avance EP2: nuevo cotizador

El cotizador ahora separa uso/presupuesto, CPU, gráfica, placa, RAM, almacenamiento múltiple, refrigeración/extras, gabinete, fuente y resumen. NestJS resuelve IDs y precios del catálogo; FastAPI revisa las reglas y el consumo; PostgreSQL conserva el detalle de piezas y cantidades de la cotización.

El catálogo de esta fase es manual, con modelos y precios de referencia, fotos de fabricantes/editores e ilustraciones de respaldo. No está sincronizado con una fuente externa. [Flujo del cotizador](docs/cotizador-ep2.md) y [procedencia de imágenes](docs/imagenes-cotizador.md).

La EP2 usa SoloTodo como fuente técnica del piloto: el administrador puede consultar de 1 a 5 fichas CPU mediante un botón en `/admin/fuentes`, sin copiar JSON. NestJS coordina la recuperación autenticada en FastAPI, valida procedencia y guarda datos/métricas en PostgreSQL; la vista privada los consulta. [Evaluación real acotada](docs/fuente-web-evaluacion.md): cinco CPU válidas y sin duplicados, pero antiguas y sin Part Number; no representa todo el catálogo. Hay espera global de un minuto, exclusión concurrente y conservación ante fallos. Reutilización/republicación sin confirmar; no hay sincronización periódica ni sustitución automática del catálogo. [Semáforo, contratos y configuración](docs/entrega-2.md).

## Diseño preliminar y cierre EP2

El [diseño adaptativo](docs/diseno-adaptativo-ep2.md) especifica alternativas de CPU según contexto, restricciones antes de preferencias, motivos visibles y control del usuario, con evaluación posterior propuesta. No se ha implementado un ranking ni se incorporan automáticamente fichas externas al cotizador. [ADR-002](docs/adr/002-referencias-y-adaptacion.md).

[Tablero local](docs/tablero-ep2.md) y [checklist/guion de demo](docs/cierre-ep2.md) actualizados. Falta validación remota final, ensayo, staging y release EP2. Los derechos de reutilización y cobertura limitada de fuente siguen explícitos. [Opciones de alojamiento investigadas](docs/staging-opciones.md), sin cuentas/contratación; GitHub Pages solo no ejecuta todos los servicios.

## Arquitectura actual EP2

`Ionic + Angular` se comunica solo con `NestJS`. NestJS administra PostgreSQL y consulta internamente el evaluador `FastAPI`.

```text
Frontend (4200) -> NestJS (3000) -> PostgreSQL (5432)
                           -> FastAPI (8000) -> SoloTodo (piloto CPU puntual)
```

Documentación de apoyo: [arquitectura](docs/arquitectura.md), [contexto](docs/diagrama-contexto.md), [contenedores](docs/diagrama-contenedores.md), [componentes](docs/diagrama-componentes.md), [modelo de datos](docs/modelo-datos-inicial.md), [despliegue preliminar](docs/despliegue-preliminar.md) y [ADR-001](docs/adr/001-arquitectura-centralizada.md).

## Carpetas

- `frontend/`: cliente Ionic + Angular.
- `backend/`: API principal NestJS y acceso a datos.
- `python-service/`: evaluador de configuraciones con FastAPI.
- `infra/`: Terraform inicial para staging.
- `docs/`: arquitectura y decisiones.

## Primer flujo demostrable

1. La persona crea una cuenta o inicia sesion como cliente.
2. Selecciona componentes compatibles y solicita la evaluacion.
3. Angular envia la solicitud autenticada a NestJS.
4. NestJS consulta FastAPI para obtener el puntaje y luego persiste la cotizacion privada en PostgreSQL.
5. La persona puede solicitar coordinacion; JembaTech gestiona el estado y el cierre se realiza por WhatsApp.

SoloTodo está en evaluación para EP2 mediante mecanismos autorizados. Instagram es una posibilidad futura, no parte comprometida de esta entrega. No se activará sincronización recurrente sin validar condiciones de uso.

## Navegacion y roles del frontend

Angular Router separa las vistas en componentes cargados de forma diferida y un `PortalLayoutComponent` reutilizable conserva logo, navegacion lateral, tema y acceso a WhatsApp.

- `/login`: acceso y registro publico.
- `/perfil`: datos personales y cambio seguro de contrasena; requiere sesion.
- `/cotizaciones`: historial privado del cliente; requiere sesion.
- `/consultas`: seguimiento de coordinaciones; requiere sesion.
- `/admin/cotizaciones-clientes`: gestion de cotizaciones recibidas; requiere rol `ADMIN`.
- `/admin/fuentes`: referencias CPU y métricas de calidad del piloto; requiere rol `ADMIN`, acceso desde el menú de cuenta.

Los guards del frontend mejoran la experiencia de navegacion. La autorizacion efectiva se valida nuevamente en NestJS, por lo que ocultar una opcion en la interfaz no reemplaza la seguridad del backend.

Las solicitudes privadas a `/api` usan `autenticacionInterceptor`: agrega el JWT desde `localStorage` de forma centralizada y, ante una respuesta `401`, elimina la sesión local y redirige a `/login`. Los servicios no construyen cabeceras `Authorization` manualmente.

## Requisitos

- Docker Desktop con Docker Compose.
- Node.js 22 para ejecutar los proyectos sin contenedores.
- Python 3.12 para ejecutar o probar FastAPI localmente.
- Terraform >= 1.6 para validar la infraestructura preliminar.

## Ejecutar con Docker Compose

1. Copia `.env.example` como `.env`, cambia la contrasena local y define una clave aleatoria larga para `JWT_SECRET`.
2. Ejecuta:

```bash
docker compose up --build
```

Servicios disponibles: frontend `http://localhost:4200`, API `http://localhost:3000/api`, FastAPI `http://localhost:8000` y PostgreSQL `localhost:5432`.

Para detener el ambiente:

```bash
docker compose down
```

## Android inicial con Capacitor

El frontend Ionic/Angular tiene Capacitor configurado con el identificador `cl.jembatech.cotizador` y la plataforma Android versionada en `frontend/android/`. Esto permite demostrar la proyección móvil de EP1 sin requerir todavía una APK final.

Para actualizar los recursos web que verá Android:

```bash
cd frontend
npm run android:prepare
```

Para abrir el proyecto nativo se requiere Android Studio instalado:

```bash
npm run android:open
```

No se versionan APK, AAB, cachés Gradle ni configuraciones locales del SDK Android.

## Endpoints principales

- `GET /api/health`: estado de NestJS.
- `GET /api/docs`: interfaz Swagger/OpenAPI de NestJS.
- `GET /api/docs-json`: especificación OpenAPI en JSON.
- `POST /api/auth/register` y `POST /api/auth/login`: crean una cuenta o emiten una sesion JWT.
- `GET /api/auth/me`: devuelve el perfil autenticado.
- `PATCH /api/auth/me`: actualiza nombre, telefono o contrasena validando primero la contrasena actual.
- `GET /api/catalog`: catálogo manual versionado y aviso de precios/fichas de referencia.
- `POST /api/builds/preview`: analiza IDs/cantidades de un borrador sin persistir; no requiere sesión.
- `POST /api/builds`: reevalúa y guarda una cotización propia con snapshot; requiere JWT.
- `PATCH /api/builds/:id`: edita borrador propio permitido con `expectedUpdatedAt`; no altera una coordinación existente.
- `POST /api/evaluations`: recibe presupuesto, uso, RAM, almacenamiento y consumo; exige sesion y guarda la cotizacion del cliente.
- `GET /api/quotes`: devuelve el historial privado del cliente; un `ADMIN` ve las cotizaciones recibidas.
- `PATCH /api/quotes/:id/request`: el cliente solicita coordinacion y agrega datos de contacto.
- `PATCH /api/quotes/:id/coordination`: un `ADMIN` actualiza estado, fecha y nota interna.
- `DELETE /api/quotes/:id` y `DELETE /api/quotes/:id/request`: retirada lógica propia de cotización/consulta, con validación de acceso.
- `GET /api/admin/sources/solotodo`, `/references` y `/runs`: resumen, referencias e historial; solo `ADMIN`.
- `POST /api/admin/sources/solotodo/cpu/recover`: recuperación confirmada de 1–5 CPU; solo `ADMIN`, con espera y clave interna hacia Python.
- `POST /api/admin/sources/solotodo/cpu/samples`: alternativa JSON declarada; solo `ADMIN` y sin consulta al proveedor.
- `GET /api/admin/observability`: métricas acotadas por proceso; solo `ADMIN`.
- `GET /health` en el puerto 8000: estado de FastAPI.
- `POST /evaluate` en el puerto 8000: evaluacion interna de una configuracion.
- `POST /builds/preview` en Python: análisis del catálogo resuelto por NestJS. Los contratos internos de fuentes están en [EP2](docs/entrega-2.md).

Swagger de FastAPI está en `http://127.0.0.1:8000/docs` durante desarrollo; `/openapi.json` entrega su contrato. En staging Python debe quedar interno. Las rutas propuestas del recomendador aún no existen.

## Pruebas

Angular ejecuta pruebas con Vitest. La prueba inicial verifica que el interceptor agrega JWT a las rutas privadas y maneja una sesión vencida:

```bash
cd frontend
npm test
```

Los controles estáticos se ejecutan antes de las pruebas en CI:

```bash
cd frontend && npm run lint
cd ../backend && npm run lint
cd ../python-service && python -m ruff check .
```

NestJS cuenta con pruebas unitarias iniciales para el registro y la prevención de correos duplicados:

```bash
cd backend
npm test
```

```bash
cd python-service
pip install -r requirements.txt -r requirements-dev.txt
python -m pytest -q
```

## Pipeline e infraestructura

El workflow [CI EP2](.github/workflows/ci.yml) ejecuta lint, pruebas unitarias/integración y salud de Compose; incorpora CodeQL, Bandit, auditoría Python/npm, detección de secretos y Trivy sobre frontend, backend, Python, migraciones y PostgreSQL. Los reportes quedan como artifacts con umbrales explícitos. [Política, parches y verificación](docs/seguridad-ep2.md).

Terraform todavía valida un contrato local, no infraestructura cloud desplegada. La configuración inicial se encuentra en [`infra/`](infra/README.md). El despliegue automatizado y health posterior a staging siguen pendientes: un job Docker aprobado no los reemplaza.

## Observabilidad inicial EP2

NestJS y FastAPI correlacionan solicitudes con `X-Request-Id`, registran eventos JSON sin cuerpos/credenciales y miden duración/errores. `GET /api/admin/observability` permite consultar contadores, promedio y máximo por ruta solo a administradores; son métricas de un proceso y se reinician con él. [Flujo, privacidad, pruebas y límites](docs/observabilidad-ep2.md).

## Variables y secretos

Los ejemplos de configuracion estan en `.env.example`, `python-service/.env.example` y `frontend/.env.example`. Los valores reales no se versionan. En GitHub Actions, los valores sensibles se agregaran como **Secrets** y los no sensibles como **Variables**.

## Alcance y limitaciones de EP1

La primera entrega demuestra la arquitectura, autenticacion JWT y roles, el flujo Angular-NestJS-FastAPI, PostgreSQL con Prisma y migraciones, contenerizacion, pipeline, Terraform preliminar y Capacitor/Android inicial. PWA completa, integración web recurrente validada y despliegue cloud siguen pendientes para las siguientes etapas.

## Prototipo y fuentes web

El prototipo navegable y los mockups de EP1 estan documentados en [Figma: JembaTech — Mockups EP1](https://www.figma.com/design/kZ1zM9aB2wOM6i9Gmc5U9f/JembaTech---Mockups-EP1?node-id=0-1&t=Z4w9Eb8TDQlvnc7i-1). Incluye el sistema visual, el flujo del cliente y las vistas de inicio, cotizador, acceso, perfil, cotizaciones y coordinacion administrativa.

SoloTodo es el candidato principal actual de EP2. [La investigación y el plan EP2](docs/entrega-2.md) distinguen acceso técnico comprobado de condiciones de reutilización aún pendientes. [La propuesta histórica EP1](docs/fuente-web-propuesta.md) conserva Mercado Libre como alternativa, sin comprometer su integración.
