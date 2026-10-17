# ADR-002: separar referencias externas y adaptación del catálogo

Fecha: 2026-10-17.

## Estado

Separación de referencias: implementada en el piloto EP2. Recomendación contextual: diseño preliminar aceptado como propuesta de trabajo, **sin implementación del ranking**. Complementa ADR-001, que mantiene NestJS como coordinador.

## Contexto

El cotizador usa un catálogo manual con precios de referencia. SoloTodo aporta un piloto acotado de fichas CPU; acceso técnico no resuelve derechos de reutilización. El primer corte verificó una ficha y la evaluación posterior cinco CPU antiguas, sin representatividad. Las especificaciones no incluyen precios/stock verificados ni benchmarks para prometer rendimiento.

## Decisión

1. Mantener `ExternalReference` y `SourceRun` separados del catálogo manual y los snapshots de cotizaciones. No convertir recuperación correcta en aprobación comercial o técnica.
2. NestJS coordina acceso administrativo, recuperación Python, validación y persistencia. Angular no consulta directamente al proveedor, Python ni PostgreSQL.
3. No asociar productos por parecido de nombre. Un uso futuro en recomendaciones exige permiso, correspondencia y campos revisados, con aprobación auditable por implementar.
4. Para una primera adaptación, proponer reglas deterministas y orden explicable: restricciones antes que preferencia, sin completar datos faltantes ni prometer FPS. El usuario conserva la decisión y el guardado reevalúa en servidor.
5. No entrenar ni desplegar IA generativa, no enviar datos personales a la fuente y no activar recuperación recurrente con este diseño.

## Alternativas consideradas

- Sustituir inmediatamente el catálogo por la fuente: descartado en esta fase por cobertura, permisos, mapeo y datos faltantes.
- Ranking de CPU por número de núcleos/TDP: descartado como indicador suficiente de rendimiento o potencia máxima.
- Modelo aprendido o generativo: aplazado; faltan datos, objetivo evaluable y una línea base que justifique su coste/complejidad.

## Consecuencias

El piloto web es demostrable sin modificar cotizaciones existentes. A cambio, el panel administrativo no constituye todavía enriquecimiento del cotizador. Habrá que implementar revisión/mapeo, versionado de política y evaluación antes de afirmar adaptación basada en datos externos. Conservar solo `lastRunId` y el hash actual no permite reproducir por sí solo todas las versiones históricas.

Especificación y criterios propuestos: [diseño adaptativo EP2](../diseno-adaptativo-ep2.md).
