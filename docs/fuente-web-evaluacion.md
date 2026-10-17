# Fuente web: evaluación acotada y cierre técnico EP2

Fecha: 2026-10-17. **El circuito técnico está implementado y evaluado; no hay autorización de reutilización recurrente confirmada.** Este informe distingue resultados reales, decisiones operativas y límites. No presenta la fuente como catálogo comercial sincronizado.

## Propósito y método

Comprobar que una adquisición real de CPU llega desde la API pública a FastAPI, pasa por preparación/validación, se guarda mediante NestJS en PostgreSQL y puede consultarse por la API usada por Angular.

Se ejecutó una sola petición de recuperación administrativa con límite 5. Python consulta una única página fija `https://api.solotodo.com/products/?categories=3&page_size=5`, con timeout, tamaño máximo y sin seguir paginación/redirecciones. No se descargan imágenes ni se consultan datos personales, ofertas o cuentas del proveedor. No hubo reintentos ni consultas adicionales para mejorar artificialmente el resultado.

La cuenta QA temporal se retiró al terminar. Se conservaron fichas y corrida, con creador opcional `null`. No se modificaron cotizaciones ni cuentas reales. La consulta HTTP del listado se verificó; esto no se presenta como una nueva revisión visual de una sesión privada de Angular.

## Identificación reproducible

- Corrida: `0c301597-c4de-46d7-8e5a-44818bfef04d`.
- Request HTTP: `454a5094-1e6b-478a-93b2-5fd9f02208bf` (distinto al ID de corrida).
- Recuperación UTC: `2026-10-17T06:42:03.974Z`.
- Origen: `manual-api`, no JSON declarado. Preparador: contrato `solotodo-cpu-1`.
- Endpoint coordinador: `POST /api/admin/sources/solotodo/cpu/recover`, solo administrador.
- Evidencia persistente: `source_runs`, `external_references` y listado autenticado del panel Fuentes y calidad.

| ID público | Modelo observado | Socket | Part Number |
| --- | --- | --- | --- |
| [8914](https://www.solotodo.cl/products/8914) | AMD A10-5700 | FM2 | No informado |
| [7223](https://www.solotodo.cl/products/7223) | AMD A10-5800K | FM2 | No informado |
| [10349](https://www.solotodo.cl/products/10349) | AMD A10-6700 | FM2 | No informado |
| [10350](https://www.solotodo.cl/products/10350) | AMD A10-6800K | FM2 | No informado |
| [13833](https://www.solotodo.cl/products/13833) | AMD A10-6790K | FM2 | No informado |

Cada registro persistido conserva URL, hash de contenido y fechas. La ficha 8914 ya existía y se volvió a comprobar; **cinco guardadas no significa cinco identidades nuevas**. El historial conserva métricas de la corrida anterior, no el contenido completo de cada versión antigua.

## Métricas aplicadas

| Métrica | Resultado | Interpretación |
| --- | --- | --- |
| Filas recibidas | 5 | Tamaño de muestra, no tamaño del catálogo. |
| Aceptadas / rechazadas / repetidas | 5 / 0 / 0 | `received = accepted + rejected + duplicates`. |
| Validez del contrato | 100% = `(5 − 0) / 5 × 100` | Valida estructura y reglas del preparador, no exactitud independiente de las especificaciones. |
| Duplicación por ID del lote | 0% = `0 / 5 × 100` | No mide duplicados entre todas las páginas del proveedor. |
| TDP declarado presente | 5/5 | TDP no equivale al consumo máximo ni permite dimensionar solo la fuente. |
| Part Number informado | 0/5 | Impide dar por resuelta una correspondencia exacta basada en SKU. No se infiere del nombre. |
| Antigüedad según fecha de origen | 148 días completos, las cinco | Diferencia entre recuperación y actualización declarada; no valida stock o exactitud física. |
| Marcas/plataformas observadas | AMD / FM2, 5/5 | No representa Intel, plataformas actuales ni variedad del catálogo. |
| Recuperación | 1164.098 ms | Transporte/lectura previo a normalización; no latencia de red aislada. |
| Preparación Python | 4.986 ms | Solo normalización. |
| Coordinación hasta cierre | 1369 ms | Incluye servicios y persistencia, no renderizado del navegador. |
| Persistidas/listadas / omitidas | 5 / 0 | Hash/identidad consultables por las rutas privadas. |

### Interpretación

Las métricas son pertinentes para fiabilidad del ingreso, deduplicación, completitud y vigencia de la información recuperada. El piloto demuestra integración y deja visibles sus carencias: una **muestra de conveniencia de la primera página**, pequeña, de una marca/plataforma antigua y sin Part Numbers. No se calcula cobertura global porque no existe aquí un conjunto objetivo independiente ni un muestreo representativo.

No se ha contrastado cada especificación con una ficha del fabricante. No afirmar precisión factual del 100%, disponibilidad, precios actuales o que estas CPU mejoran el cotizador. No se sustituyen productos internos ni se crean coincidencias automáticas.

## Revisión de condiciones y política operativa

Se revisaron nuevamente el 2026-10-17 las [condiciones de servicio](https://www.solotodo.cl/terms), la [privacidad](https://www.solotodo.cl/legal) y la [raíz de API](https://api.solotodo.com/). Las condiciones describen información referencial, sin garantía de exactitud y con respeto de derechos de terceros; **no se identificó allí una licencia expresa para republicar el catálogo ni una cuota acordada de extracción**. Esto es un registro de revisión, no una autorización del proveedor ni dictamen legal.

Decisiones del piloto:

- Uso acotado de comprobación académica, privado y bajo demanda; sin agenda/cron, sin extracción masiva y sin copiar descripciones o imágenes. La condición operativa no se interpreta como excepción legal automática.
- Desactivado por defecto en clones/CI. Activar el piloto local o confirmar una petición no otorga derechos del proveedor. Mantener `reuse-not-confirmed` y no publicar enriquecimiento del cotizador.
- Cada consulta tiene límite 1–5 y espera global de 60 s, sin reintento automático. La espera es un control propio, **no una cuota concedida por SoloTodo**. Respetar cualquier denegación o límite recibido; no eludirlos con la sonda.
- Reabrir la página consulta PostgreSQL, no la fuente. Conservar último dato válido; fallos quedan auditados con códigos seguros. No hay refresco periódico comprometido.
- No enviar nombres, correos, direcciones, presupuesto, tokens de usuario ni configuraciones de clientes a la fuente. No consultar rutas de usuarios/cotizaciones del proveedor.
- Las fichas no tienen aquí un TTL que garantice vigencia: mostrar ambas fechas, identificar desconocidos y revisar antes de usos nuevos. Frecuencia recurrente, caché de producción y retención final quedan condicionadas al alcance autorizado.

### Consulta preparada para el proveedor — no enviada

> Estamos desarrollando JembaTech como proyecto universitario. Queremos confirmar si se permite consultar y conservar un conjunto pequeño de especificaciones CPU de su API para una demostración académica y, eventualmente, mostrar campos técnicos con atribución. No necesitamos imágenes, datos personales ni una copia masiva. ¿Qué condiciones, atribución, límites, caché y frecuencia se aplicarían? ¿Hay un mecanismo oficial o permiso específico para este uso?

Enviar esa consulta requiere autorización del titular y una cuenta de contacto elegida por él. No se ha enviado mensaje ni creado una cuenta. Si el proveedor no autoriza, desactivar adquisición y acordar una alternativa de datos con licencia explícita; no cambiar de fuente ni simular un permiso silenciosamente.

## Reproducción controlada

Primero revisar la corrida existente en el panel; repetir no es necesario para leer esta evidencia. Para una nueva comprobación autorizada, desde la raíz, con servicios locales/piloto habilitados:

```powershell
node scripts/evaluate-source.mjs --live --limit 5
```

Sin `--live` el script no consulta Docker/red ni crea cuentas. Límite 1–5, una petición, sin URLs arbitrarias o reintento; crea una cuenta QA temporal solo para autenticar la operación y retira exclusivamente esa cuenta. Conserva referencias y auditoría. El resumen excluye credenciales/datos de cuentas. Una nueva corrida puede producir datos y tiempos distintos; no prometer igualdad de respuestas externas.

Las pruebas automáticas usan red simulada y no ejecutan este comando. Casos de contratos/errores están en [EP2](entrega-2.md), y el cierre general en [tablero](tablero-ep2.md).
