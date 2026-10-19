# Arquitectura — estado EP2

Actualizado: 2026-10-17. Se mantiene la decisión central de EP1 y se incorporan cotizador por componentes, piloto de fuentes y observabilidad. Se distingue implementación de propuesta.

## Decisión

Arquitectura centralizada: Angular consume NestJS como única API pública de datos. El navegador no consulta PostgreSQL, FastAPI ni SoloTodo. Los puertos de diagnóstico locales no deben trasladarse como exposición pública a staging.

## Motivo

Esto concentra autenticación, roles, contratos, resolución del catálogo y persistencia. FastAPI especializa la evaluación del armado y la recuperación/preparación de CPU; no accede a la base ni administra cuentas.

## Responsabilidades

| Componente | Responsabilidad |
| --- | --- |
| Ionic + Angular | Presets/personalizado, selección múltiple, temas verde/cian, edición, consultas y panel administrativo de fuentes. |
| NestJS | API REST/JWT/roles, catálogo manual autoritativo, snapshots y coordinación; validación/auditoría de fuentes y métricas privadas. |
| PostgreSQL + Prisma | Usuarios, cotizaciones/snapshots, referencias externas y corridas. Catálogo y presets siguen en código, no en tablas administrables. |
| FastAPI | Reglas de compatibilidad, consumo estimado y puntaje; recuperación CPU acotada, normalización, deduplicación y métricas. |
| Nginx / proxy de desarrollo | Sirve la SPA y envía `/api` a NestJS. Nginx registra acceso JSON sin URL, query o credenciales. |

## Recorridos implementados

1. **Cotizar:** Angular → `/api/catalog` y `/api/builds/preview` → NestJS resuelve IDs/precios → FastAPI `/builds/preview` → análisis. Guardar requiere JWT; NestJS conserva snapshot y resultado en PostgreSQL. Editar valida propiedad y versión concurrente; una coordinación existente se conserva mediante el flujo de copia.
2. **Fuente:** administrador → `/api/admin/sources/solotodo/cpu/recover` → NestJS inicia auditoría → FastAPI consulta una página CPU fija → prepara → NestJS valida contrato/procedencia → transacción PostgreSQL → listado privado en Angular. También se admite JSON declarado, identificado como tal.
3. **Diagnóstico:** `/api/health` verifica PostgreSQL; Python tiene `/health`. `X-Request-Id` correlaciona HTTP y dependencia Python, con eventos JSON y métricas por proceso en `/api/admin/observability` solo para `ADMIN`.

## Límites y decisiones

- El piloto externo no cambia piezas, precios o cotizaciones. Solo CPU, máximo 5 por consulta manual, espera global de 60 s, sin cron ni imágenes. Reutilización/republicación pendientes; no hay stock/precios vigentes.
- Ante fallos se registra código seguro y se conserva el último dato válido. Una muestra JSON no sobrescribe una referencia adquirida por API. Los eventos no registran cuerpos, claves o cuentas.
- `internalCatalogId` es una posibilidad de vínculo futuro, no una aprobación implementada. El ranking contextual solo está especificado en el [diseño adaptativo](diseno-adaptativo-ep2.md).
- Actualización 2026-10-19: Railway staging y CD de `c4dd5dd` tienen salud completa
  comprobada. Terraform adoptó 16 objetos con plan real sin cambios ni diferencias
  observadas; [evidencia y límites](adopcion-railway-evidencia.md). El manifiesto
  EP1 raíz sigue siendo histórico. Métricas sin histórico centralizado y riesgos
  de seguridad se detallan por separado.
- Instagram y fuentes alternativas no forman parte de este piloto. Figurar en una propuesta no activa una integración.

[Contexto](diagrama-contexto.md), [contenedores](diagrama-contenedores.md), [componentes](diagrama-componentes.md), [modelo de datos](modelo-datos-inicial.md), [ADR-001](adr/001-arquitectura-centralizada.md), [ADR-002](adr/002-referencias-y-adaptacion.md), [seguridad](seguridad-ep2.md), [observabilidad](observabilidad-ep2.md) y [evidencia EP2](entrega-2.md).
