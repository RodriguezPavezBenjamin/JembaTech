# Precios consultados del cotizador — corte local 2026-10-18

Este corte añade precios de ofertas a la integración técnica; no convierte el catálogo completo en un comparador comercial ni certifica su vigencia. Se añadieron ocho búsquedas técnicas (23 selecciones en total) y dos productos al cotizador: Ryzen 5 9600X WOF y ASRock RX 9060 XT Challenger 16GB OC. Los IDs anteriores y snapshots se conservan.

## Fuente y criterio de precio

La raíz pública [publicapi.solotodo.com](https://publicapi.solotodo.com/) anuncia productos, entidades/ofertas y monedas. Una ficha técnica de producto no contiene por sí sola su precio. Se verificó `currencies/1/`: `iso_code=CLP`.

Consulta por ID de producto exacto: `entities/?products=ID&is_available=1&page_size=5`. El filtro singular no se presupone correcto; se valida además el ID en cada resultado. Una página, 10 s, 1 MB, sin seguir `next`, redirecciones, reintentos o consultas a tiendas. No se importan fotos o descripciones desde SoloTodo. Los nombres de tienda mostrados son **hosts de la URL publicada**, no nombres comerciales inferidos.

Solo se aceptan ofertas visibles, nuevas, disponibles según la fuente, en CLP, sin bundle/plan/cupón/pago mensual, con precios enteros positivos coherentes y actualización de registro dentro de 24 h (tolerancia futura de 5 min). Los datos desconocidos no se convierten en cero. Se rechazan URLs no HTTPS, credenciales y destinos locales evidentes; la aplicación no navega ni hace fetch de esas URLs.

El total usa el menor **precio normal publicado dentro de esa página**; se muestra por separado su precio de oferta. No se afirma que sea el más barato del mercado, ni se presume que el precio normal equivalga a todos los medios de pago. Despacho, garantía, disponibilidad y condiciones deben confirmarse en el oferente. Las [condiciones de SoloTodo](https://www.solotodo.cl/terms) consideran referencial su información y requieren corroborarla con los oferentes.

La oferta caduca al cumplirse 24 h desde la menor de su fecha de registro y la consulta. Sin oferta apta o vencida se utiliza el precio base claramente marcado **ESTIMADO**, no cero ni otro SKU. Un fallo de red conserva el precio anterior solo mientras siga dentro de ese plazo; una consulta válida vacía lo retira y deja constancia, sin revivir una oferta anterior tras reiniciar.

## Correspondencias revisadas

| ID interno | Producto SoloTodo | Presentación / Part Number |
| --- | --- | --- |
| cpu-7600 | 166287 | 100-100001015BOX, no 7600X/Tray |
| gpu-4060 | 211481 | MSI RTX 4060 VENTUS 2X BLACK 8G OC, no Ti/EVO |
| board-msi-b550-a-pro | 85687 | MSI B550-A PRO; sin Part Number declarado |
| ram-kingston-ddr4-rgb-16 | 118735 | KF432C16BBAK2/16, kit 2 × 8 GB |
| drive-kingston-a400-480 | 33675 | SA400S37/480G, 480 GB SATA 2.5 pulgadas, no M.2 |
| drive-samsung-990-pro-1000 | 157430 | MZ-V9P1T0BW, 1 TB sin disipador; no variante /AM |
| cpu-9600x | 252401 | 100-100001405WOF, no Tray/MPK |
| gpu-asrock-9060xt-16 | 278239 | RX9060XT CL 16GO, no Steel Legend ni Challenger 8 GB |

No hay correspondencia automática por nombre ni autorización implícita para republicar un catálogo completo. Las restantes piezas mantienen precios manuales identificados. No se habilitaron cron, publicación, staging o uso recurrente; condiciones de reutilización siguen pendientes fuera del piloto local.

Los dos modelos añadidos usan fichas primarias [AMD 9600X](https://www.amd.com/en/products/processors/desktops/ryzen/9000-series/amd-ryzen-5-9600x.html), [ASRock Challenger 16GB](https://www.asrock.com/Graphics-Card/AMD/Radeon%20RX%209060%20XT%20Challenger%2016GB%20OC/index.us.asp) y [AMD 9060 XT 16GB](https://www.amd.com/en/products/graphics/desktops/radeon/9000-series/amd-radeon-rx-9060xt.html). El consumo usado para planificación sigue siendo una estimación explícita del perfil: 142 W CPU y 200 W GPU, no TDP/TBP certificados o consumos medidos. Se muestran límites de BIOS, cooler y fuente. La foto GPU se enlaza a ASRock; el CPU conserva ilustración de respaldo, sin usar la foto de otro modelo.

## Operación y conservación

- `GET /api/admin/sources/solotodo/prices`: ocho modelos revisados, sin red externa.
- `POST /api/admin/sources/solotodo/prices/recover`: `{ "target": "cpu-7600", "acknowledged": true }`; JWT ADMIN y habilitación de piloto exigidos.
- FastAPI valida la respuesta de origen y NestJS revalida contrato, identidad, moneda, fechas, condiciones e integridad antes de aplicar.
- El cooldown global de 60 s y la exclusión PostgreSQL `manual-api` son compartidos con las consultas técnicas. No se eluden al cambiar componente o sección.
- Auditoría `SourceRun.metrics.kind=price-quote` con contrato `solotodo-prices-1`; ofertas y procedencia separadas de referencias técnicas. Sin migración ni cambios en `internalCatalogId`.
- Caché del único proceso NestJS local, reconstruida desde auditorías al iniciar. No se afirma invalidación entre múltiples réplicas; deberá resolverse antes de escalar staging.
- `CatalogService.list/resolve` aplican el mismo precio del servidor. El cliente no envía un precio aceptado por el backend. Las nuevas revisiones/guardados incluyen el precio y su procedencia; las cotizaciones existentes no se recalculan al recuperar precios. Una edición voluntaria sí usa el catálogo actual, como informa su diálogo.
- La interfaz diferencia PRECIO CONSULTADO / ESTIMADO, ofrece detalles de tienda, fecha, oferta y vencimiento, y mantiene la selección de tarjetas separada de sus detalles.

Evaluación manual opcional, una acción por vez, nunca en CI:

```powershell
node scripts/update-catalog-price.mjs --live --target cpu-7600
```

El script retira exclusivamente su cuenta QA temporal y verifica precio/listado/persistencia; sin `--live` no consulta ni escribe. No ejecutarlo en bucle; respetar la espera global.

## Comprobaciones de este corte

El backend y Python se reconstruyen sin recrear PostgreSQL ni ejecutar migraciones. Hay pruebas sin red de valores, moneda, disponibilidad, fechas, vínculos, ofertas inválidas, caché, ausencia de precio, expiración, confirmación y conservación. La integración aislada comprueba 401/403, persistencia PostgreSQL, reconstrucción y cooldown compartido usando ofertas sintéticas; no se presenta como adquisición real. El workflow añade esa prueba, pero su nueva ejecución remota sigue pendiente.

Las corridas reales siguientes son puntuales y de cobertura limitada. Un resultado vacío no se sustituye con otra variante ni se recorre automáticamente otra página.

| Modelo | Corrida | Resultado en el catálogo |
| --- | --- | --- |
| Ryzen 7600 BOX | `7145a399-fda2-4a39-b257-a34ebfd35e84` | 5/5 ofertas aptas; normal $230.745, oferta $216.900, tienda.pc-express.cl. Consulta 06:00:05.285 UTC; registro de precio 03:23:13.729 UTC del 18/10/2026. |
| MSI RTX 4060 Ventus 2X Black OC | `b477a701-8d14-4faa-bddd-eb915ea4a7bc` | Página vacía de ofertas disponibles; continúa ESTIMADO. |
| MSI B550-A PRO | `71e521b0-51dc-4c21-9afa-5c8d8d7f1928` | Página vacía de ofertas disponibles; continúa ESTIMADO. |
| Kingston kit RGB DDR4 2 × 8 GB | `a47c5295-b5ef-4d98-a1e5-4a4d007ac628` | Página vacía de ofertas disponibles; continúa ESTIMADO. |
| Kingston A400 480 GB SATA 2.5 pulgadas | `3a0fc53c-d4a7-4d87-9da6-83f44856d162` | 5/5 ofertas aptas; normal $101.293, oferta $93.190, www.wei.cl. Consulta 06:06:13.918 UTC; registro de precio 03:17:18.125 UTC del 18/10/2026. |
| Samsung 990 PRO 1 TB MZ-V9P1T0BW | `6df8e15e-d739-420b-917b-5dabc4103884` | Página vacía de ofertas disponibles; continúa ESTIMADO. No se sustituyó por /AM. |
| Ryzen 9600X WOF | `cf1f40b3-8bb4-471d-a8fd-40f2d1c8c4d1` | 5/5 ofertas aptas; normal $225.990, oferta $219.900, tecnomas.cl. Consulta 06:09:17.596 UTC; registro de precio 03:26:14.478 UTC del 18/10/2026. |
| ASRock RX 9060 XT Challenger 16GB OC | `490c9ad7-f44e-423f-96a7-912847d574b8` | 5 recibidas, 4 aptas, 1 descartada; normal $614.694, oferta $579.900, store.infor-ingen.com. Consulta 06:10:33.350 UTC; registro de precio 03:21:47.683 UTC del 18/10/2026. |

Resultado: ocho consultas manuales independientes, cuatro páginas vacías y cuatro con ofertas; 20 filas recibidas, 19 aptas y 1 descartada. Cuatro precios normales consultados realmente aplicados al catálogo; los cuatro SKU sin oferta conservan estimación explícita. No se reintentó una consulta vacía ni se eludió el cooldown. Las fechas indicadas corresponden a este corte, no a una promesa de vigencia posterior.

Validación final local: 114 pruebas NestJS, 161 Python y 58 Angular aprobadas; lint/build de frontend/backend, Ruff y Bandit aprobados. Las 25 pruebas Node de seguridad/documento aprobaron. La advertencia previa Starlette/TestClient-httpx sigue visible y el montaje Windows requiere excluir solo EXE002 de Ruff local; no se cambió la política CI. Un test DOM nuevo necesitó importar Zone.js, corregido y repetido satisfactoriamente.

Se repitieron las tres integraciones en `jembatech-price-check` con PostgreSQL temporal y fuente desactivada; los escenarios positivos de ofertas usaron transporte sintético, no datos reales. 401/403, DTOs, persistencia, reconstrucción de caché, ausencia de precio y espera compartida aprobados. Solo se retiraron los contenedores/red/volumen de ese proyecto aislado. La base principal quedó intacta; las cuentas de evaluación real se retiraron.

Una revisión HTTP real NestJS→FastAPI del armado con 9600X/9060 XT devolvió `can_save=true`, sin piezas faltantes y mínimo de fuente de 550 W; solo advertencias de módulos separados y almacenamiento de 480 GB. No se guardó esa cotización de prueba. No se realizó una sesión visual autenticada del administrador; las comprobaciones de interfaz fueron DOM/build.

Salud final aprobada de frontend/proxy/backend/Python/PostgreSQL; cero cuentas QA de evaluación pendientes. La huella SHA-256 de las 12 cotizaciones coincidió antes y después de las ocho adquisiciones sin mostrar su contenido. Staging/release y la ejecución remota de Actions de estos cambios siguen pendientes; no se hizo commit ni push.
