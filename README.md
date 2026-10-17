# JembaTech

Aplicacion multiplataforma para crear cotizaciones de PC, elegir presets y recibir una evaluacion explicable de compatibilidad, rendimiento esperado y ajuste al presupuesto.

## Avance EP2: nuevo cotizador

El cotizador ahora separa uso/presupuesto, CPU, gráfica, placa, RAM, almacenamiento múltiple, refrigeración/extras, gabinete, fuente y resumen. NestJS resuelve IDs y precios del catálogo; FastAPI revisa las reglas y el consumo; PostgreSQL conserva el detalle de piezas y cantidades de la cotización.

El catálogo de esta fase es manual, con perfiles y precios de referencia. Las imágenes son ilustraciones originales por categoría. La integración con una fuente web real sigue pendiente y no debe confundirse con este catálogo inicial. [Flujo, contratos, pruebas y pendientes EP2](docs/cotizador-ep2.md).

## Arquitectura EP1

`Ionic + Angular` se comunica solo con `NestJS`. NestJS administra PostgreSQL y consulta internamente el evaluador `FastAPI`.

```text
Frontend (4200) -> NestJS (3000) -> PostgreSQL (5432)
                           -> FastAPI (8000)
```

Documentación de apoyo: [contexto](docs/diagrama-contexto.md), [contenedores](docs/diagrama-contenedores.md), [componentes](docs/diagrama-componentes.md), [modelo de datos](docs/modelo-datos-inicial.md), [despliegue preliminar](docs/despliegue-preliminar.md) y [ADR-001](docs/adr/001-arquitectura-centralizada.md).

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

La integracion con SoloTodo e Instagram se incorpora en EP2 mediante mecanismos autorizados; no se hara scraping sin validar condiciones de uso.

## Navegacion y roles del frontend

Angular Router separa las vistas en componentes cargados de forma diferida y un `PortalLayoutComponent` reutilizable conserva logo, navegacion lateral, tema y acceso a WhatsApp.

- `/login`: acceso y registro publico.
- `/perfil`: datos personales y cambio seguro de contrasena; requiere sesion.
- `/cotizaciones`: historial privado del cliente; requiere sesion.
- `/consultas`: seguimiento de coordinaciones; requiere sesion.
- `/admin/cotizaciones-clientes`: gestion de cotizaciones recibidas; requiere rol `ADMIN`.

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
- `POST /api/evaluations`: recibe presupuesto, uso, RAM, almacenamiento y consumo; exige sesion y guarda la cotizacion del cliente.
- `GET /api/quotes`: devuelve el historial privado del cliente; un `ADMIN` ve las cotizaciones recibidas.
- `PATCH /api/quotes/:id/request`: el cliente solicita coordinacion y agrega datos de contacto.
- `PATCH /api/quotes/:id/coordination`: un `ADMIN` actualiza estado, fecha y nota interna.
- `GET /health` en el puerto 8000: estado de FastAPI.
- `POST /evaluate` en el puerto 8000: evaluacion interna de una configuracion.

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

El workflow [CI EP1](.github/workflows/ci.yml) construye Angular, NestJS y FastAPI, ejecuta pruebas unitarias de NestJS y FastAPI, detecta secretos, valida Terraform (`fmt`, `validate` y `plan`) y construye las tres imagenes Docker. La configuracion inicial de staging y las instrucciones de validacion se encuentran en [`infra/`](infra/README.md).

## Variables y secretos

Los ejemplos de configuracion estan en `.env.example`, `python-service/.env.example` y `frontend/.env.example`. Los valores reales no se versionan. En GitHub Actions, los valores sensibles se agregaran como **Secrets** y los no sensibles como **Variables**.

## Alcance y limitaciones de EP1

Esta primera entrega demuestra la arquitectura, autenticacion JWT y roles, el flujo Angular-NestJS-FastAPI, PostgreSQL con Prisma y migraciones, contenerizacion, pipeline y Terraform preliminar. Aun faltan PWA/Capacitor, fuente web autorizada y despliegue cloud; se implementaran incrementalmente en las siguientes etapas.

## Prototipo y fuentes web

El prototipo navegable y los mockups de EP1 estan documentados en [Figma: JembaTech — Mockups EP1](https://www.figma.com/design/kZ1zM9aB2wOM6i9Gmc5U9f/JembaTech---Mockups-EP1?node-id=0-1&t=Z4w9Eb8TDQlvnc7i-1). Incluye el sistema visual, el flujo del cliente y las vistas de inicio, cotizador, acceso, perfil, cotizaciones y coordinacion administrativa.

La fuente propuesta para EP2 es la API oficial de Mercado Libre Chile, bajo sus permisos y términos de desarrollador. [La propuesta de uso responsable](docs/fuente-web-propuesta.md) explica el alcance, la trazabilidad y por qué SoloTodo e Instagram no se consumen automáticamente en EP1.
