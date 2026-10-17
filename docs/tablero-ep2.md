# Tablero de seguimiento EP2

Actualizado: 2026-10-17. Tablero **local Markdown**, aclarado con el usuario; no se creó ni modificó un GitHub Project. Describe avance verificable, no certifica aprobación final de la entrega.

## Hecho en local

- [x] Cotizador y gestión de cotizaciones: flujo, cantidades, edición, consultas y vistas administrativas.
- [x] Recuperación CPU real bajo demanda → FastAPI → NestJS → PostgreSQL → listado privado para Angular.
- [x] Normalización, deduplicación, identidad/hash/fechas, permisos de acceso y auditoría; conservación ante fallos.
- [x] Evaluación acotada de cinco CPU reales, fórmulas/resultados y límites documentados en [fuente web](fuente-web-evaluacion.md). No se declara muestra representativa.
- [x] Revisión y registro de condiciones del proveedor; operación sin cron, sin imágenes/datos personales y con espera. **No equivale a obtener permiso de republicación.**
- [x] Diseño adaptativo preliminar, arquitectura/modelo/diagramas y ADR actualizados.
- [x] Seguridad y observabilidad inicial implementadas, con pruebas locales y hallazgos/límites explícitos. El bloqueo de imágenes incluye CRITICAL sin parche; resultado remoto pendiente.
- [x] Tablero local y guion de demostración preparados.

## En validación

- [ ] Usuario: revisar archivos preparados, hacer [commit/push](validacion-commit-ep2.md) y compartir el resultado del run **CI EP2** de ese commit. No usar el verde EP1 como evidencia nueva.
- [ ] Revisar artifacts/hallazgos y corregir cualquier fallo real antes de marcar validación remota aprobada.
- [ ] Ensayar la demo sobre la versión final y confirmar fecha/modalidad con la profesora.

## Pendiente por decisión externa

- [ ] **Staging:** elegir alojamiento autorizado, configurar Terraform/Secrets, despliegue desde Actions, salud y URL. [Opciones investigadas](staging-opciones.md), sin cuentas ni recursos creados.
- [ ] **Release EP2:** mantener pendiente hasta tener commit validado y versión desplegada identificable; no mover ni reemplazar la release EP1.
- [ ] **Derechos de la fuente:** confirmar reutilización/republicación antes de uso recurrente o enriquecimiento público. El análisis está hecho; la respuesta del proveedor no existe y no se marca aprobada.

## Fuera de cierre técnico del piloto / evolución posterior

- [ ] Muestra representativa de plataformas/modelos actuales y contraste técnico independiente.
- [ ] Flujo de aprobación/mapeo de referencias al catálogo, precios/stock si se autorizan y otras categorías.
- [ ] Implementar y evaluar el motor adaptativo especificado; no es necesario terminarlo para el diseño preliminar EP2.

La cobertura limitada se debe exponer en la defensa y puede afectar el nivel de la rúbrica; documentarla no elimina esa limitación. Detalle: [cierre y demo](cierre-ep2.md) y [semáforo](entrega-2.md).
