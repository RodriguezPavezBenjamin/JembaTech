# SoloTodo: ampliación privada de componentes

Fecha: 2026-10-18. Ampliación privada del piloto; no autoriza reutilización/republicación ni activa sincronización comercial. La evidencia histórica de cinco A10 se conserva en [evaluación inicial](fuente-web-evaluacion.md).

Actualización posterior del mismo día: [precios consultados](precios-cotizador.md) añade ocho correspondencias revisadas y un adaptador separado de ofertas. Las fichas técnicas de este documento no cambian por sí solas el precio; la acción confirmada de precios sí afecta nuevas revisiones del cotizador. Los cortes de pruebas/recuperaciones siguientes son históricos.

## Qué cambia

- El panel permite elegir CPU, GPU, placa madre, RAM o almacenamiento y una búsqueda dirigida por modelo, en lugar de recuperar por defecto las primeras CPU del proveedor.
- Selección inicial: Ryzen 5 7600/9600X, Core i5-14400/Ultra 5 245K, GeForce RTX 4060/5060 y Radeon RX 7600/9060 XT. Combina referencias del cotizador y modelos de comparación posteriores; no es exhaustiva ni garantiza los últimos lanzamientos.
- Cada acción consulta UNA página de hasta cinco candidatas. Puede incluir sufijos, Tray/Box, ensambladores o capacidades distintas; no identifica un SKU interno automáticamente.
- Filtros por categoría, marca/chip y texto, sobre PostgreSQL. Filtrar/abrir la página no consulta SoloTodo.
- Fechas separadas y aviso interno de revisión si la actualización de origen supera 90 días. No es un TTL ni garantía del proveedor. `100% válidas` significa contrato estructural, no precisión factual.
- CPU híbridas: suma de núcleos de rendimiento y eficiencia, contrastada con el total cuando existe. No mostrar solo los P-cores como total.
- GPU: fabricante/ensamblador separado del chip. VRAM normalizada (valor API / 1024), tipo de memoria y opcionales de largo, slots, interfaz y TDP de chip. Desconocidos permanecen `null`, no cero.
- Placas: socket, chipset, formato, DDR4/DDR5, slots RAM y conectores M.2/SATA declarados. No certifica BIOS, compatibilidad física ni uso simultáneo de puertos.
- RAM: capacidad del kit y de cada módulo, cantidad, DDR4/DDR5, formato, velocidad MT/s y CL si existe. Se verifica que total = capacidad por módulo × cantidad.
- Almacenamiento: HDD/SSD, capacidad comercial en GB, interfaz, formato, conector y RPM o lectura/escritura declaradas. No dividir los GB de discos por 1024; M.2 o PCIe no demuestran por sí solos el protocolo NVMe.
- TDP de chip GPU no equivale al consumo de la tarjeta o recomendación de PSU. No se importan fotos, descripciones, ofertas, stock o precios ni se cambian cotizaciones.

## Contrato y rutas

Se conservan las rutas CPU originales para reproducción histórica. Contrato `solotodo-components-2`, categoría `cpu | gpu | motherboard | ram | storage` y atributos permitidos bajo `specs`; validación independiente en Python y NestJS.

| Ruta administrativa | Uso |
| --- | --- |
| `GET /api/admin/sources/solotodo/targets` | Selecciones de búsqueda, sin claves privadas. |
| `POST /api/admin/sources/solotodo/components/recover` | `{ "target": "rx-9060xt", "acknowledged": true }`. Una consulta puntual confirmada. |
| `POST /api/admin/sources/solotodo/components/samples` | `{ "category": "gpu", "retrievedAt": "ISO con zona", "records": [...] }`, 1–5 registros originales declarados. No certifica adquisición. |
| `GET /api/admin/sources/solotodo/references?category=gpu&brand=NVIDIA&q=&page=1&pageSize=12` | Filtrado persistente; marca reconoce ensamblador o chip, máximo 50 por página. |

Todas las rutas NestJS requieren JWT y ADMIN. FastAPI añade `/sources/solotodo/components/normalize` y `/sources/solotodo/components/recover`; recuperación protegida por habilitación explícita y clave interna. Python debe permanecer en red interna al desplegar.

Las URLs salen de una lista literal cerrada, nunca de texto/URLs del usuario. Límites: 10 s, 1 MB, sin redirecciones, sin seguir `next` ni reintentar. Espera global de 60 s y exclusión PostgreSQL por `mode: manual-api`, compartidas con el piloto CPU. Cambiar categoría no elude la espera. Errores auditados sin cuerpos ni secretos.

No cambia Prisma: las cinco categorías comparten tabla con categoría explícita. Las escrituras no modifican `internalCatalogId`; una muestra declarada no sobrescribe una adquisición API. Un ID existente de otra categoría no se reclasifica silenciosamente.

La lista cerrada incluye además MSI B650/B760, Kingston FURY Beast DDR4/DDR5, Seagate Barracuda HDD, Crucial MX500 SATA y Kingston NV3 PCIe M.2: 15 selecciones en total. La categoría de almacenamiento distingue IDs externos HDD=8 y SSD=39. Cada fila recuperada debe contener los términos de su selección en nombre/chip; Python registra `target_mismatch` para lo ajeno y NestJS comprueba de nuevo las aceptadas. Es pertinencia de familia, no equivalencia SKU ni filtro de actualidad.

## Verificación de campos

Comprobación pública acotada del 18 de octubre: CPU=3/GPU=2; `search` junto a `categories` devuelve variantes. Se inspeccionaron 3 fichas Ryzen 5 7600, 2 RTX 4060, 1 RX 9060 XT y 1 Ultra 5 245K. No se conservaron respuestas completas, imágenes o precios.

La ficha Intel declara 6 P-cores + 8 E-cores = 14; la GPU AMD cantidad de memoria 16384, normalizada a 16 GB. Es observación del formato, no contraste independiente con fabricantes ni evidencia de persistencia mediante la aplicación.

## Validación local del primer bloque CPU/GPU (histórica)

- Backend: lint/build y 75 pruebas aprobadas, incluidas 42 de fuentes CPU/GPU.
- Angular: build/lint y 51 pruebas aprobadas; 13 del panel (selección, filtros sin red, confirmación, fechas, faltantes y VRAM).
- Python: 111 pruebas aprobadas sin red; Ruff y Bandit aprobados. Ruff local excluye EXE002 únicamente porque el montaje Windows presenta todos los archivos como ejecutables; no se modifica la política de CI. Una advertencia del TestClient de Starlette sobre httpx queda visible, sin cambiar dependencias en este bloque.
- Seguridad Node: 16 pruebas aprobadas.
- Integraciones HTTP reales NestJS-FastAPI-PostgreSQL y recuperación con transporte simulado aprobadas en el proyecto QA aislado `jembatech-source-check`. Se retiraron sus contenedores, red y volumen temporal; la base principal no intervino.
- Permisos 401/403, categorías, fabricante/chip, VRAM, conservación, cooldown global CPU/GPU y bloqueo concurrente cubiertos. Fixtures identificadas como sintéticas; CI no consulta SoloTodo.

Evaluación real manual opcional, solo con piloto habilitado y condiciones revisadas:

```powershell
node scripts/evaluate-source.mjs --live --target ryzen-7600
# Otra acción independiente después de la espera global; no ejecutar en bucle:
node scripts/evaluate-source.mjs --live --target rx-9060xt
```

Sin `--live` no hay red, Docker ni registros. `--target` no se combina con `--limit`; no se aceptan URLs libres. Cada ejecución crea y retira solo su cuenta QA; conserva referencias y auditoría privadas.

## Recuperaciones reales dirigidas

La primera recuperación real dirigida quedó registrada: corrida `9a3ce3b7-3d2c-47ce-a6ec-36f4f0c1ab77`, correlación `97250a55-a093-44c5-b90e-cfdf847c9631`, recuperada `2026-10-18T05:22:18.358Z`. Cinco CPU recibidas/aceptadas/guardadas, sin rechazos ni duplicados; cinco Part Numbers presentes. IDs `151869`, `166287`, `196152`, `252739`, `396801`. Incluye 7600, 7600X y 7600X3D/Tray: candidatas de familia, no coincidencia única. Antigüedad de origen 100–149 días; esto confirma por qué consultar ahora no vuelve reciente una ficha. Preparación 0.606 ms, recuperación 1108.193 ms, coordinación 1206 ms. Persistencia/listado autenticado comprobados; cuenta QA retirada. Un intento posterior para GPU quedó bloqueado por cooldown antes de consultar la fuente; no se creó corrida ni se eludió la espera.

Después de la espera se completó una única adquisición GPU: corrida `a8ee00a0-2247-4901-aee0-1c268022294d`, correlación `cca8cd50-593a-4139-b604-b0ed25ca2b2e`, recuperada `2026-10-18T05:23:44.424Z`. Cinco RX 9060 XT recibidas/aceptadas/guardadas, sin rechazos/duplicados; variantes ASRock/ASUS de 8 y 16 GB, con cinco Part Numbers, largos 202–298 mm y slots 2–3. IDs `277775`, `277886`, `278239`, `279546`, `355722`. Antigüedad de origen 73 días; preparación 0.495 ms, recuperación 499.156 ms, coordinación 546 ms. Persistencia y listado autenticado comprobados; cuenta QA retirada.

Son diez candidatas dirigidas a dos búsquedas, no una muestra representativa de todas las marcas/categorías. Intel/NVIDIA tienen selecciones y contratos probados, pero no se declara una recuperación integrada real de esas selecciones en este corte. No se realizó una sesión visual privada del administrador: comprobaciones por HTTP autenticado y pruebas DOM.

Los servicios locales backend/Python se actualizaron sin recrear PostgreSQL ni ejecutar migraciones. Salud final de frontend, proxy, NestJS, FastAPI y base: aprobada. La huella SHA-256 del conjunto de cotizaciones coincidió antes y después de ambas recuperaciones, sin exponer su contenido. Las cuentas QA temporales se retiraron; las diez referencias y sus corridas se conservan para revisión privada.

## Segundo bloque: placas, RAM y almacenamiento

Corte local del 2026-10-18, posterior al CPU/GPU. Contratos, consulta confirmada, persistencia, filtros y fichas diferenciadas disponibles para las cinco categorías. No se ejecutaron migraciones ni se recreó la base principal.

Verificación del formato mediante consultas públicas acotadas: placa=5, RAM=7, HDD=8 y SSD=39. Una búsqueda Samsung 990 devolvió una 970 y otra búsqueda 990 PRO devolvió un producto A-DATA; esas observaciones no se guardaron como candidatas y motivaron comprobar pertinencia en ambas fronteras. No se siguieron páginas para forzar resultados.

Las capacidades de RAM/VRAM se convierten desde las unidades de 1024 de esos campos; las de discos se conservan en GB comerciales. Un kit 2 × 16 GB se muestra como 32 GB, distinto de un módulo 1 × 32 GB. Slots M.2/SATA ausentes quedan desconocidos (`null`), distintos de cero explícito. La familia NV3 se consulta como SSD PCIe M.2: el modelo puede emplear NVMe, pero estos campos del proveedor no declaran el protocolo y no lo completamos por inferencia.

Validación local de este segundo bloque:

- NestJS: lint/build y 92 pruebas aprobadas, incluidas validación independiente, pertinencia, tipos/unidades y coherencia de kits.
- Angular: lint/build y 55 pruebas aprobadas, 17 del panel. Incluye fichas de placa/RAM/disco, TDP no aplicable y aviso cuando todas las filas son descartadas.
- Python: 135 pruebas aprobadas sin red; Ruff y Bandit aprobados. Se conserva la salvedad local EXE002 del montaje Windows y la advertencia previa de Starlette/TestClient.
- CLI/seguridad Node: 16 pruebas aprobadas, con las 15 selecciones cerradas.
- Documento/arranque: 7 pruebas aprobadas; 23 en conjunto con seguridad Node. El test de salud necesitó permiso para abrir/conectar su puerto local efímero, bloqueado en el primer intento aislado; aprobado al repetir sin esa restricción.
- Integraciones reales HTTP con PostgreSQL aislado aprobadas para CPU/GPU/placas/RAM/HDD/SSD, permisos, unidades, métricas y conservación. Recuperación simulada para fallos/cooldown/concurrencia aprobada; no consulta al proveedor desde CI. Contenedores/red/volumen exclusivos QA retirados.

Las consultas reales de este bloque son acciones manuales independientes, una página de hasta cinco fichas, sin reintentos de red ni recorrido automático. Un primer intento DDR5 quedó bloqueado por la espera antes de consultar al proveedor; luego se ejecutó una acción independiente al terminar el cooldown. Se conservan las corridas y se retiran exclusivamente las cuentas QA temporales.

Adquisiciones de este bloque, persistidas y listadas por HTTP autenticado:

| Selección | Recuperada UTC | Corrida / correlación | Recibidas / aceptadas / guardadas | Preparación / red / total (ms) |
| --- | --- | --- | --- | --- |
| MSI B650 | 2026-10-18T05:40:32.644Z | `790d06f3-ceb7-4634-bb02-dff8e6a5dfd6` / `bd81136f-82c8-4617-a71f-c374e6b7bb27` | 5 / 5 / 5 | 2.072 / 1355.358 / 1467 |
| Kingston FURY Beast DDR5 | 2026-10-18T05:42:09.227Z | `605375cd-a489-4fc9-b241-ba607f71abf0` / `e230295e-594c-4f2b-b49d-e8bb4806de05` | 5 / 5 / 5 | 1.959 / 1124.88 / 1172 |
| Seagate Barracuda HDD | 2026-10-18T05:43:22.302Z | `ecebaefa-dca3-4521-8e84-2a496b5929f0` / `c54637b0-bac6-4a0f-86c2-f188f9acb7d6` | 5 / 5 / 5 | 0.975 / 1122.884 / 1211 |
| Crucial MX500 SATA | 2026-10-18T05:44:38.791Z | `ed73a02b-74cd-4edd-8cde-afe1b4653c01` / `e6c68b0f-5e0b-4188-bb06-7d320f3b173c` | 5 / 5 / 5 | 0.589 / 925.802 / 967 |
| Kingston NV3 PCIe M.2 | 2026-10-18T05:45:54.670Z | `324e8baa-df30-49c9-ab02-95a41cc80b82` / `9a4292fc-e73c-4852-85af-8fc574c2201f` | 5 / 5 / 5 | 0.424 / 632.471 / 674 |

Sin rechazos ni duplicados en esas tres páginas. Placas: 2–4 slots DDR5, 2 M.2 y 4–6 SATA; Part Number ausente en las cinco. RAM: módulos de 8/16/32 GB y un kit 2 × 16 GB, 4800/6000 MT/s, CL30/36/38. HDD: 160–14000 GB, formatos 2.5/3.5 pulgadas y 7200 RPM, incluyendo referencias antiguas. Las 15 fichas declaran actualización de mayo (149 días de antigüedad): recuperar hoy no demuestra lanzamiento reciente, stock ni vigencia comercial. No se presenta la muestra como representativa ni como catálogo actualizado.

La página MX500 tampoco tuvo rechazos/duplicados: 250 y 1000 GB comerciales, lectura/escritura declaradas 560/510 MB/s, cinco Part Numbers y 149 días desde actualización de origen. Incluye tanto 2.5 pulgadas como M.2 2280, **todos SATA**: evidencia concreta de por qué M.2 no debe clasificarse automáticamente como NVMe.

NV3: cinco fichas aceptadas/guardadas, sin rechazos/duplicados, 1000/2000/4000 GB comerciales, formatos M.2 2280 y 2230, PCIe 4.0 x4, lectura 6000 y escritura 4000/5000 MB/s declaradas. Cinco Part Numbers, 149 días desde actualización de origen y protocolo desconocido en los campos importados. Los límites de representatividad/actualidad se aplican también aquí.

En total, este segundo bloque conserva 25 candidatas nuevas de cinco páginas, con trazabilidad privada. MSI B760 y RAM DDR4 tienen contratos/selecciones y pruebas sintéticas, pero no se declara una adquisición integrada real de ellas en este corte. Ninguna comprobación HTTP o DOM se presenta como una sesión visual autenticada del administrador.

Comprobación final: frontend/proxy/NestJS/FastAPI/PostgreSQL saludables; cero cuentas QA temporales de estas evaluaciones. Las 12 cotizaciones conservan la misma huella SHA-256 antes y después de las cinco adquisiciones, sin exponer su contenido. El catálogo y los precios manuales no se modificaron. Nueva ejecución remota de Actions, staging y release siguen pendientes.

## Pendientes

- Mapeo revisado modelo/SKU y contraste técnico; no está implementada su aprobación ni el enriquecimiento público del cotizador.
- Condiciones de reutilización, límites y operación recurrente confirmados. `reuse-not-confirmed` sigue vigente.
- PSU, gabinetes y refrigeración requieren contratos propios; aún no habilitados. El protocolo NVMe queda desconocido si la fuente no lo declara; no inferirlo del formato M.2.
- El bloque técnico no aplica precios. El adaptador posterior de [precios consultados](precios-cotizador.md) cubre ocho correspondencias, no todo el catálogo ni stock garantizado. Staging, release y nueva ejecución de Actions pendientes; no atribuir el CI anterior a estos cambios sin publicar.
