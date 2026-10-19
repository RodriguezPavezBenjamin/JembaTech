# Despliegue preliminar - EP1

Estado EP2, 2026-10-19: Railway ya está funcionando. El esquema siguiente conserva
la ejecución local EP1; no describe el despliegue cloud actual. Ver [Railway staging](railway-staging.md)
para salud/versiones, CD preparado pendiente de activar y adopción Terraform aún pendiente.

EP1 se ejecuta de forma reproducible con Docker Compose. La infraestructura Terraform incluida en `infra/` documenta el contrato inicial de staging; la selección de proveedor cloud se resolverá en la siguiente etapa.

```mermaid
flowchart TB
  DEV[Equipo de desarrollo\nDocker Desktop]
  subgraph COMPOSE[Docker Compose]
    FRONT[frontend\nAngular servido por Nginx\n4200:80]
    API[backend\nNestJS\n3000]
    PY[python-service\nFastAPI\n8000]
    MIGRATE[migrate\nPrisma migrate deploy]
    DB[(database\nPostgreSQL 16\nvolumen postgres_data)]
  end
  BROWSER[Navegador] -->|http://localhost:4200| FRONT
  FRONT -->|/api| API
  API -->|http://python-service:8000| PY
  API -->|DATABASE_URL| DB
  MIGRATE -->|DATABASE_URL| DB
  DEV --> COMPOSE
```

## Orden de inicio

1. `database` inicia y su health check espera a PostgreSQL.
2. `migrate` ejecuta `prisma migrate deploy` cuando la base está saludable.
3. `backend` inicia solo cuando la migración termina correctamente.
4. `frontend` entrega la aplicación Angular en el puerto `4200`.

## Variables necesarias

| Variable | Uso | Dónde se define |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | Contraseña local de PostgreSQL. | `.env` (basado en `.env.example`). |
| `JWT_SECRET` | Firma de tokens JWT. | `.env`; nunca se versiona. |
| `DATABASE_URL` | Conexión de NestJS/Prisma con PostgreSQL. | La genera Docker Compose internamente. |
| `PYTHON_SERVICE_URL` | URL interna del evaluador. | Docker Compose: `http://python-service:8000`. |

## Comandos de verificación

```bash
docker compose up --build
docker compose ps
curl http://localhost:3000/api/health
curl http://localhost:8000/health
```

Para detener sin borrar la base de datos local:

```bash
docker compose down
```

## Seguridad inicial

- Las claves reales se mantienen en `.env`, ignorado por Git.
- `JWT_SECRET` es obligatorio antes de iniciar NestJS.
- PostgreSQL y FastAPI se comunican por la red privada de Docker Compose; sus puertos expuestos son solo una facilidad de desarrollo y diagnóstico local.
- CI revisa secretos con TruffleHog y comprueba las imágenes con Trivy. Ver [controles y límites EP2](seguridad-ep2.md); la aceptación final de cambios depende también de las reglas del repositorio.
