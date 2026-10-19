# EP2: plan de trabajo y evidencia

Estado vigente, 2026-10-19: Railway ya sirve la web y el usuario confirmó Google y
el recorrido cliente/admin. CD y salud completa de `c4dd5dd` están comprobados;
Terraform adoptó 16 objetos con plan real sin cambios y estado cifrado, según
[evidencia](adopcion-railway-evidencia.md). Token temporal revocado por el propietario.
El panel de fuentes ya muestra cinco fichas reales según las capturas del usuario,
[trasladadas como muestra declarada](muestra-staging-ep2.md), no adquisición nueva.
Pendiente la publicación/CI del commit final; no repetir adquisiciones ni imports
para generar evidencia.
Ver [estado de cierre](cierre-ep2.md)
y [pasos de Railway](railway-staging.md). El semáforo y cortes del 18/10 siguientes
son históricos; no significan que haya que volver a crear staging.

Actualizado: 2026-10-18. Este documento separa requisitos de la pauta, decisiones del proyecto y verificaciones reales. No declara terminada la entrega.

Ampliación local del 18 de octubre: [CPU, GPU, placas, RAM y discos por modelo](fuente-web-componentes.md), contratos, panel y pruebas locales aprobados. Las rutas históricas CPU de los cortes siguientes se conservan; no describen por sí solas el alcance actual. Esta ampliación aún requiere commit/push y validación en Actions; no modifica el catálogo ni cotizaciones.

Corte de precios anterior: [precios consultados del cotizador](precios-cotizador.md), ocho modelos vinculados explícitamente, dos productos añadidos y 23 búsquedas técnicas. No recalcula cotizaciones históricas.

Último corte: [catálogo SoloTodo para el armador](catalogo-solotodo.md), importación local confirmada de CPU, GPU, RAM, placas y gabinetes, con foto de la ficha, precio normal CLP, fecha y caducidad. Topes 35/30/20/20/15; no son cantidades garantizadas. Los productos importados sin oferta vigente se bloquean, no se muestran como estimaciones actuales. Derechos de publicación, CI remota nueva y staging siguen pendientes.

## Objetivo de la pauta

Demostrar fuente web real → recuperación → preparación en Python/FastAPI → NestJS → PostgreSQL/índice → Angular, con una métrica aplicada, errores controlados y staging. Referencia local: `ProyectoFinal .pdf`, páginas 35–40, en la carpeta superior del proyecto.

La capacidad inteligente completa, A/B y evaluación final con usuarios no son obligatorias todavía. Sí lo es su diseño preliminar. SoloTodo y el alcance inicial CPU son decisiones de JembaTech, no proveedores exigidos por la profesora.

## Semáforo histórico del 18/10 (estado vigente arriba)

| Bloque | Estado | Evidencia / falta |
|---|---|---|
| Base EP1 y mejoras del cotizador | Implementado y CI aprobado | Commit `68a0b0d`, CI EP2 #7: frontend/backend/Python y Docker aprobados junto a los controles. No acredita staging. |
| Fuente SoloTodo | Piloto ampliado a cinco categorías; reutilización sin confirmar | Se conserva la muestra histórica A10 y se añaden búsquedas dirigidas de CPU, GPU, placas, RAM y HDD/SSD, con fechas y límites en `fuente-web-componentes.md`. Sin sincronización comercial. |
| Preparación Python | Cinco categorías implementadas y verificadas localmente | Contratos separados, VRAM, núcleos híbridos, slots/puertos, módulos/kits, unidades de discos, pertinencia, deduplicación, fechas/hash y métricas. No equivale a catálogo actualizado. |
| Recuperación automatizada | Piloto bajo demanda; dos circuitos separados | Referencias técnicas: hasta 5 candidatas. Importador del armador: 25 candidatas CPU o 10 de otra categoría y hasta 5 consultas de ofertas, con foto identificada. Sin agenda; espera y bloqueo global compartidos. Uso recurrente por confirmar. |
| NestJS + persistencia externa | Implementado para piloto privado | Adquisición API con procedencia registrada y alternativa JSON declarada; validación, transacción, referencias únicas e historial. |
| Consulta y visualización externa | Panel privado y vínculo local al armador | `/admin/fuentes` separa referencias técnicas de importación confirmada. El armador muestra modelos importados con foto y oferta apta; conserva IDs manuales históricos/presets sin modificar cotizaciones. Campos de montaje ausentes quedan por confirmar. |
| Precios de nuevas cotizaciones | Piloto local ampliado | Oferta normal CLP, tienda, fechas y caducidad para modelos importados; ocho mapeos anteriores conservados. Sin oferta vigente el importado no se cotiza; fallo de red conserva la versión anterior. No garantiza stock/mínimo global. Ver `catalogo-solotodo.md` y `precios-cotizador.md`. |
| Evaluación de datos reales | Evaluación acotada aplicada a cinco CPU | 5/5 válidas, 0 duplicadas, 0/5 Part Numbers y antigüedad de origen 148 días. Persistencia/listado verificados; no representa modelos actuales ni exactitud independiente. Ver `fuente-web-evaluacion.md`. |
| Diseño adaptativo preliminar | Especificado; motor futuro no implementado | Usuario, contexto, datos, decisión, reglas/orden, salida, control, riesgos y evaluación posterior en `diseno-adaptativo-ep2.md`; no afirma ranking ni IA completa. |
| Seguridad, observabilidad y staging | CI aprobado; staging pendiente | CI EP2 #7 aprueba ambos CodeQL, secretos, auditorías, Terraform y Docker. Conservar/revisar reportes; no hay staging ni histórico centralizado de métricas. |
| Entrega evaluable | CI anterior verificado; ampliación local pendiente de publicar | Faltan condiciones del proveedor, nueva CI, staging, ensayo y release EP2. La cobertura útil es acotada, no completa ni certificada. Ver `tablero-ep2.md`. |

Los cortes conservan evidencia histórica: sus cifras y pendientes corresponden al momento indicado. El estado más reciente se resume arriba y en [tablero local](tablero-ep2.md), [evaluación de fuente](fuente-web-evaluacion.md), [cierre EP2](cierre-ep2.md), [seguridad](seguridad-ep2.md) y [observabilidad](observabilidad-ep2.md).

## Validación remota aprobada y siguiente sesión

Verificado en GitHub el 2026-10-17: [CI EP2 #7](https://github.com/RodriguezPavezBenjamin/JembaTech/actions/runs/39012531921), commit `68a0b0d7b91463bfeb9e8057e88166e5fc9c6ab1`, resultado `success`; los nueve jobs aprobaron. GitHub Pages también aprobó para ese commit, pero sigue sin sustituir staging del sistema completo. El primer run fallido permanece como evidencia histórica, no como estado actual.

Para retomar mañana se agrega al [tablero](tablero-ep2.md) convertir Fuentes y calidad en un apoyo real del cotizador: modelos actuales/de uso común, categorías principales, contratos por categoría, mapeo revisado, procedencia/antigüedad y datos efectivamente utilizables. No basta con recuperar otra vez las mismas fichas antiguas. Precios/stock y frecuencia recurrente requieren datos/acceso/condiciones confirmados; no hay activación automática ni cambio del catálogo por este cierre documental.

## Último cierre técnico: fuente y seguimiento

El 2026-10-17 se ejecutó una sola recuperación confirmada de hasta cinco CPU por el flujo existente. Corrida `0c301597-c4de-46d7-8e5a-44818bfef04d`: 5 recibidas/aceptadas, 0 rechazadas/duplicadas, preparación 4.986 ms, recuperación 1164.098 ms y coordinación 1369 ms. Se comprobaron persistencia y listado autenticado. La cuenta QA se retiró; no se modificaron cotizaciones.

El circuito ya existía; este corte añade evaluación reproducible, informe y revisión operativa, no una integración distinta. Las cinco fichas son AMD/FM2, tienen 148 días desde la actualización declarada y ninguna informa Part Number. No hay cobertura representativa, precio/stock, mapeo aprobado o autorización de republicación; esos límites permanecen explícitos. Script manual `scripts/evaluate-source.mjs --live --limit 5`, nunca ejecutado por CI.

El seguimiento solicitado es el [tablero Markdown local](tablero-ep2.md), sin creación de GitHub Project. Staging y release permanecen pendientes; [opciones sin contratar](staging-opciones.md).

## SoloTodo: investigación técnica

Verificado mediante consultas públicas puntuales el 2026-10-17:

- [Raíz de la API](https://api.solotodo.com/): HTTP 200, anuncia productos, categorías y otras rutas.
- [Categorías](https://api.solotodo.com/categories/): CPU = 3; GPU = 2; placas = 5; discos duros = 8; fuentes = 9; gabinetes = 10. No asumir IDs de otras categorías sin comprobarlos.
- `GET https://api.solotodo.com/products/?categories=3&page_size=1`: HTTP 200, ficha `8914`, AMD A10-5700, categoría 3. Muestra antigua: no demuestra disponibilidad comercial ni cobertura de modelos actuales.
- **`category=3` no filtró**: retornó un producto de abarrotes. Se usa `categories=3` y se valida además `category_id == 3` en cada fila.
- La ficha observada contiene `id`, `name`, `brand.name`, `part_number`, `last_updated` y `specs` con socket, núcleos, hilos y TDP. No incluye un precio que podamos asumir como precio vigente en CLP.
- [Condiciones actuales](https://www.solotodo.cl/terms): información referencial, sin garantía de exactitud, corroboración con vendedores y respeto de derechos de terceros. La antigua ruta `/legal_information` devolvió 404.
- [Privacidad](https://www.solotodo.cl/legal): no necesitamos usuarios, correos, presupuestos ni alertas del proveedor; no se consultan esas rutas.
- `https://www.solotodo.cl/robots.txt`: `User-agent: *` y `Disallow: /search`. `https://api.solotodo.com/robots.txt`: HTTP 404. **Esto no concede licencia de reutilización ni autorización para copiar imágenes.**
- [Repositorio público minitodo](https://github.com/SoloTodo/minitodo): ejemplos de Django/consultas sobre productos. No constituye por sí solo un contrato de API pública ni permiso sobre su catálogo.

Estado: acceso técnico público comprobado; uso recurrente y republicación por confirmar. No se han enviado mensajes ni creado cuentas. Antes de sincronizar/publicar: documentar alcance permitido, atribución, límites, caché y derechos de imágenes. Si se requiere contacto, preparar una consulta y enviarla solo con autorización del titular de JembaTech. No eludir autenticación, bloqueos o límites.

## Primer corte implementado

### Contrato y procesamiento

`POST /sources/solotodo/cpu/normalize` en FastAPI recibe:

```json
{
  "retrieved_at": "2026-10-17T12:00:00Z",
  "results": []
}
```

`results` son filas con la estructura del proveedor (máximo 50). Este endpoint no consulta URLs ni persiste. NestJS ahora lo coordina mediante una ruta protegida de muestras (máximo 5 filas). En producción el servicio Python deberá quedar en red interna; no exponerlo directamente a Internet.

1. Validar identidad numérica, categoría CPU, nombre/marca, socket y conteos.
2. Normalizar Unicode/espacios, descartar controles invisibles y rechazar marcado en campos cortos. No copiar descripciones, HTML, plantillas o imágenes.
3. Conservar Part Number cuando exista, sin inferirlo del nombre.
4. Mantener TDP declarado como tal: **no equivale al consumo máximo de CPU ni permite dimensionar por sí solo la fuente**. No completar RAM, BIOS o potencia desconocidas con suposiciones.
5. Diferenciar recuperación UTC de actualización indicada por la fuente. Rechazar fechas sin zona horaria/futuras incoherentes.
6. Deduplicar por ID externo: conservar primera fila válida, registrar repetición/conflicto. No fusionar por nombre ni inventar correspondencias con nuestros IDs.
7. Crear hash SHA-256 de contenido normalizado, independiente de fecha de consulta.
8. Retornar URL canónica, datos, incidencias y métricas. `price_clp: null`; no inventar precio, stock ni vigencia. `access_status: reuse-not-confirmed` permanece hasta resolver condiciones.

### Métricas de esta fase

- `received = accepted + rejected + duplicates`.
- `valid_percent = 100 × (received - rejected) / received`: incluye filas válidas repetidas.
- `duplicate_percent = 100 × duplicates / received`: repeticiones válidas por ID después de la primera.
- `missing_tdp`: fichas aceptadas sin TDP; no son necesariamente inválidas.
- `processing_ms`: solo limpieza/preparación; **no mide latencia de red**.
- Lote vacío: porcentajes 0, nunca división por cero. Reportar siempre tamaño de muestra; 100% de una sola ficha no significa 100% de cobertura.

### Sonda manual

Desde `python-service/`, con dependencias instaladas:

```powershell
# Sin --live se rechaza la operación antes de consultar la red.
python probe_solotodo.py --live --limit 1
```

Consulta una sola página pública de CPU, con identificación de JembaTech, límite 1–5, timeout 10 s y respuesta máxima 1 MB. No sigue redirecciones ni `next`; no reintenta 401/403/429. No descarga imágenes, no escribe archivos, no persiste y no toca el cotizador. Es una comprobación técnica puntual, no permiso de uso recurrente.

### Pruebas

```powershell
python -m ruff check .
python -m pytest -q
```

Las pruebas de preparación y transporte usan **fixtures sintéticas y red simulada**: fichas inválidas, categorías ajenas, duplicados/conflictos, fechas, hash, límites, timeout, 403, 429, HTTP 500, redirecciones, JSON inválido y cuerpo excesivo. El job Python existente las recoge automáticamente; CI no consulta SoloTodo.

### Evidencia de este primer corte

- Suite Python completa: **62 pruebas aprobadas**, incluyendo las pruebas previas del cotizador. Un aviso de deprecación de Starlette/AnyIO, no un fallo.
- Imagen Docker Python construida con los módulos nuevos; los servicios en uso no se reiniciaron.
- Sonda real ejecutada con `--live --limit 1`, recuperación `2026-10-17T04:05:48.509013Z`.
- Resultado: CPU `8914`, AMD A10-5700; 1 recibida, 1 aceptada, 0 rechazadas, 0 duplicadas, 0 sin TDP; `valid_percent: 100`, `processing_ms: 2.612` (solo procesamiento).
- Hash normalizado: `1926c5a47a4f96b605f6c85cf46ec50feb2a8afb18c22a49bc18f2a50557aa87`.
- La fuente declara actualización `2026-05-22T00:11:34.931201Z`: no es la fecha de recuperación ni prueba de stock/precio actual. Precio permanece `null`.
- No se guardó el catálogo externo en PostgreSQL ni se sustituyeron productos del cotizador. Los datos anteriores son un registro manual de evidencia; falta historial persistente de corridas.
- **Una ficha antigua no es una muestra representativa:** no permite afirmar cobertura, actualidad de todo el catálogo o precisión de precios.

## Siguientes cortes, en orden

1. Cerrar condiciones de SoloTodo y alcance de datos. Confirmar cómo recuperar precios/moneda/tiendas si su uso está permitido. No confundir fichas técnicas con ofertas.
2. **Recuperación CPU bajo demanda implementada:** una página, límites, registro, timeouts y conservación. Pendiente muestreo útil de modelos actuales, otras categorías y política de caché/actualización recurrente autorizada.
3. **Base de muestras implementada:** NestJS coordinador admin, validación de respuesta Python, Prisma con identidad externa única, fechas/hash y corridas. Pendiente coordinar adquisición autorizada y vínculo revisado con producto interno.
4. **Consulta privada implementada:** paginación, búsqueda y vista admin de procedencia/fecha/calidad. Pendiente integrar al cotizador solo productos mapeados y compatibles, con datos faltantes visibles.
5. Evaluación real reproducible: lote acotado por categoría, porcentaje válido/duplicado, campos faltantes, antigüedad y tiempos; demostrar fuente caída sin perder cotizaciones.
6. **Diseño adaptativo especificado:** [usuario, entradas, restricciones, orden explicable, salida y evaluación posterior](diseno-adaptativo-ep2.md). Implementar el motor y evaluar utilidad corresponde a trabajo posterior; no se activa por documentarlo.
7. Completar seguridad/observabilidad/staging de la pauta: SAST, auditoría Python e imágenes, correlación/logs, integración, despliegue automatizado, health posdespliegue y evidencia.
8. Consolidar documentación, tablero, demo y release EP2. Confirmar fecha de entrega: los documentos del curso muestran fechas diferentes.

El rediseño visual ya aprobado se conserva. Android se revisó después por petición explícita: [wrapper y diagnóstico corregidos](android-validacion.md), con preparación Capacitor, APK debug, prueba unitaria y lint nativo aprobados localmente usando JDK 21 y SDK en D:. Portada confirmada en emulador y flujos manuales confirmados por el usuario tanto en web como en Android. Quedan pendientes el test instrumentado automatizado y la conexión con el futuro staging.

## Cuarto corte documental: diseño y preparación del cierre

Especificación adaptativa, ADR-002, arquitectura, contexto/contenedores/componentes y modelo actualizados al estado real. El catálogo manual sigue separado de referencias; las tablas de catálogo administrable y el ranking no se presentan como existentes. Se incorpora [checklist, evidencias y guion de demo](cierre-ep2.md).

El usuario confirma que no dispone de alojamiento elegido. La pauta exige staging automatizado con salud posterior (pp. 38–39), pero no determina un proveedor comercial en esos apartados. Falta consultar recursos institucionales o acordar alojamiento/costes, y entonces implementar infraestructura/despliegue real. No se crean cuentas, contrataciones ni credenciales por este corte.

La documentación no cierra condiciones de SoloTodo, muestra representativa, ejecución remota de los cambios ni entrega final. No se han ejecutado experimentos del recomendador propuesto.

## Segundo corte: muestras privadas de punta a punta

Flujo de este segundo corte: **muestra declarada por admin → NestJS → preparación FastAPI → validación de respuesta NestJS → PostgreSQL → consulta Angular**. Se probó sin llamar a SoloTodo. La adquisición real integrada se agrega en el tercer corte descrito al final; no confundir la evidencia sintética con la real.

### Rutas y permisos

Todas las rutas siguientes exigen JWT y rol `ADMIN`; visitantes reciben 401 y clientes 403. El guard de Angular es complementario, no la autorización efectiva.

| Ruta NestJS | Función |
|---|---|
| `GET /api/admin/sources/solotodo` | Conteos, último lote y estado explícito de sincronización desactivada. |
| `GET /api/admin/sources/solotodo/references?q=&page=1&pageSize=12` | Fichas CPU, búsqueda por nombre/marca/Part Number y paginación (máximo 50 por página). |
| `GET /api/admin/sources/solotodo/runs` | Últimas 20 corridas, métricas, incidencias y errores seguros; sin identidad del administrador. |
| `POST /api/admin/sources/solotodo/cpu/samples` | Preparar y guardar 1–5 fichas. Cuerpo `{ "retrievedAt": "ISO con zona", "records": [...] }`. No hace peticiones al proveedor. |

Swagger incorpora la ruta y contrato de entrada. NestJS limita espera de Python a 5 s, tamaño de petición/respuesta y valida esquema, IDs, URL de origen, fechas, conteos, tipos, métricas y hash de formato antes de persistir. Las identidades devueltas deben pertenecer al lote enviado. Campos ajenos no se copian.

### Persistencia y conservación

- Migración aditiva `20261017043000_external_references`, aplicada localmente. No modifica `quotes` ni sus snapshots.
- `external_references`: identidad única `(source, external_id)`, nombre/marca/Part Number, datos técnicos normalizados, URL, fechas distintas de recuperación/actualización, hash, estado de derechos y modo de adquisición.
- `internal_catalog_id` es opcional y queda `null`: no se vinculan piezas por coincidencia de nombre ni se sustituyen precios/reglas.
- `source_runs`: estado `RUNNING/SUCCEEDED/FAILED`, fechas, usuario iniciador, métricas, incidencias, cantidad escrita y omisiones. No se almacena respuesta bruta, fotografías, descripciones o HTML.
- Índices por fuente/categoría/recuperación, fuente/marca, vínculo interno y fecha de corridas. Búsqueda inicial con `contains` sin distinguir mayúsculas; todavía no hay índice de texto completo/ranking.
- Escrituras de fichas y cierre exitoso en una transacción. El registro de fallo queda separado. Si PostgreSQL no permite iniciar auditoría, no se llama a Python.
- Ficha repetida entre corridas conserva un solo registro. Una fecha anterior no pisa la última ficha; un contenido distinto con igual fecha tampoco. La corrida registra `staleSkipped` (antigüedad o conflicto temporal).
- `storedCount` cuenta fichas escritas en la corrida, no nuevas identidades; reimportar contenido idéntico puede actualizar la auditoría sin crear otra ficha.
- Los fallos no borran ni vacían datos previos. Una interrupción abrupta del proceso puede dejar una corrida en `RUNNING`; su recuperación automática sigue pendiente.
- `mode/acquisitionMode: manual-sample` y `accessStatus: reuse-not-confirmed`. La fecha y procedencia del lote son declaradas por admin; no son prueba independiente de cuándo se consultó el proveedor.

### Panel y muestra mínima

Ingresar como administrador → menú de cuenta/avatar → **Fuentes y calidad**, debajo de Clientes. Ruta `/admin/fuentes`. La opción aparece solo para administradores tanto en inicio como en rutas internas; se retira del pie de página y de cotizaciones de clientes. La API mantiene JWT y rol. La página conserva los temas verde/cian, muestra un vacío real si no hay fichas, y no carga productos de demostración automáticamente.

Una consulta puntual (no periódica) puede producir el JSON mínimo para pegar en **Validar una muestra CPU**:

```powershell
Set-Location python-service
python probe_solotodo.py --live --limit 1 --batch
```

`--batch` exporta exclusivamente los campos necesarios con fecha de consulta, sin imágenes/descripciones. No guarda archivos ni envía nada al backend. Revisar la muestra y pegarla en el panel realiza la preparación/persistencia privada. No activar un proceso recurrente ni republicar datos hasta confirmar las condiciones del proveedor.

### Verificación del segundo corte

- Angular: **42 pruebas**, build y lint aprobados.
- NestJS: **44 pruebas**, build y lint aprobados; casos de respuesta inválida/identidades ajenas, auditoría indisponible y fallos de persistencia incluidos.
- Python: **63 pruebas**, lint e imagen Docker aprobados.
- Integración HTTP autenticada `tests/integration/sources.test.mjs`: **aprobada localmente**, circuito real NestJS-FastAPI-PostgreSQL con muestras **sintéticas**, 401/403, repetición, actualización, antigüedad/conflicto, lote inválido, búsqueda y límites. Crea cuentas QA temporales y retira solo sus registros.
- Fallo real de transporte comprobado mediante instancia aislada del coordinador apuntando a un puerto local sin servicio: respuesta controlada 503, corrida `FAILED/PYTHON_UNAVAILABLE` y hash de ficha anterior intacto. No se detuvieron servicios para simularlo.
- La prueba de fuentes se añade al job Docker de CI, sin Internet externo. El resultado remoto requiere commit/push y no se declara verificado aún.
- Las 6 comprobaciones de integración existentes del cotizador siguen aprobadas. No se atribuyen los resultados sintéticos a precisión/cobertura del catálogo de SoloTodo.
- Logs de preparación estructurados con `requestId` igual al ID de corrida, duración y código seguro. No contienen tokens, datos de cuenta ni lote bruto. Correlación global de toda la aplicación y métricas de red siguen pendientes.
- Tras actualizar servicios, proxy `4200/api/health` devuelve `database: ok` y `/admin/fuentes` responde HTTP 200 como ruta SPA. Los datos privados se verificaron por HTTP autenticado y pruebas DOM; esto no se presenta como revisión visual de una sesión real del administrador.
- Corregida entrada directa a rutas internas: faltaba `<base href="/">` y `main.js` se buscaba en `/admin/main.js`, dejando pantalla en blanco. Se verificó que el servidor ahora entrega el módulo correcto en `/main.js`. Seis pruebas de documento/build cubren fuentes, clientes, perfil y login; el job frontend las ejecuta tras compilar. Un HTTP 200 de la página por sí solo no demuestra que Angular haya arrancado.

### Pendientes que no cambia este corte

Condiciones/atribución/límites de SoloTodo, recuperación recurrente autorizada, precios y moneda verificados, muestra real representativa, correspondencia revisada con catálogo, otras categorías, caché/actualización, diseño adaptativo formal, seguridad ampliada, observabilidad global y staging automatizado. Ninguna pantalla nueva significa que EP2 esté completamente terminada.

## Tercer corte: recuperación web integrada bajo demanda

Flujo actual verificado: **botón Angular → NestJS → SoloTodo mediante FastAPI → preparación Python → validación NestJS → PostgreSQL → consulta del panel Angular**. No se necesita copiar JSON. La prueba real verificó las rutas HTTP y persistencia; las interacciones del botón están cubiertas por pruebas DOM, sin atribuir una revisión visual a una sesión privada.

### Operación y alcance

- Administrador → avatar → **Fuentes y calidad** → **Consultar SoloTodo**.
- Elegir 1, 3 o 5 fichas, confirmar consulta puntual y pulsar **Consultar y guardar**.
- `POST /api/admin/sources/solotodo/cpu/recover`, cuerpo `{ "limit": 1, "acknowledged": true }`; exige JWT y rol `ADMIN`.
- NestJS inicia auditoría `mode: manual-api` y llama `POST /sources/solotodo/cpu/recover` en Python, transmitiendo ID de corrida y clave interna, nunca un JWT de usuario ni una URL arbitraria.
- Python consulta únicamente `https://api.solotodo.com/products/?categories=3&page_size=N`, una sola página. Sin paginación, redirecciones, imágenes o credenciales del proveedor.
- El servidor genera fecha de recuperación y devuelve URL exacta, ID de correlación y tiempo. NestJS comprueba esos valores y el contrato antes de persistir.
- Hasta 5 CPU por consulta; 60 s entre intentos globales, incluidos fallos, sin reintento automático. Índice único parcial de PostgreSQL impide consultas API activas simultáneas entre procesos.
- Auditoría API `RUNNING` interrumpida hace más de 2 min se marca `FAILED/INTERRUPTED` al intentar una nueva consulta. La regla no recupera todavía auditorías JSON interrumpidas.
- Una respuesta vacía se registra como tal, sin crear productos. Una respuesta inválida, 401/403/429 o fuente caída genera error seguro y conserva el último dato válido.
- La muestra JSON queda como herramienta avanzada. No puede sobrescribir una referencia recuperada por API; una recuperación real sí puede reemplazar una referencia solo declarada. Se conservan vínculos internos ya existentes, sin crear coincidencias automáticas.
- `staleSkipped` también incluye omisiones por nivel de confianza (JSON frente a API), además de fecha/conflicto. No representa pérdida de datos.
- Los precios siguen sin verificarse y no se actualiza el cotizador. `accessStatus: reuse-not-confirmed` sigue vigente: consentimiento del operador **no equivale a licencia del proveedor**.

### Configuración y seguridad

Desactivado por defecto en clones/CI. Configurar en `.env` local (excluido de Git), y reiniciar Python/NestJS:

```dotenv
SOLOTODO_MANUAL_PROBE_ENABLED=true
SOURCE_INTERNAL_TOKEN=valor_aleatorio_de_32_bytes_en_64_caracteres_hexadecimales_minusculos
```

Generar el token con una herramienta criptográfica, por ejemplo Node `crypto.randomBytes(32).toString('hex')`; no usar el valor ilustrativo ni reutilizar JWT_SECRET. El mismo token se entrega solo a NestJS y Python. La implementación rechaza placeholders/no hexadecimales. No se envía a Angular, se registra en logs ni se versiona. Para staging debe ir en Secrets.

Python publica el puerto local en `127.0.0.1:8000`; en despliegue debe quedar exclusivamente en red interna. La ruta de recuperación exige `X-Source-Token`: una petición directa sin clave no hace red externa. El timeout de fuente es 10 s y el de NestJS 15 s; cuerpo de proveedor máximo 1 MB, respuesta normalizada máximo 200 KB.

No hay cron, automatización recurrente ni consulta por abrir/refrescar la página: el panel lee PostgreSQL. El temporizador visual cuenta la espera localmente y no llama al proveedor. La sonda CLI sigue siendo una herramienta local independiente; no debe usarse para eludir límites.

### Persistencia y métricas adicionales

Migración aditiva `20261017050000_source_recovery`, aplicada localmente:

- URL de petición en `source_request_url`, tiempo de recuperación en `retrieval_ms` y duración del coordinador en `duration_ms`.
- `retrieval_ms`: petición, lectura y preparación del lote antes de normalización; no es una medición aislada de latencia de red.
- `processingMs`: normalización de CPU en Python; `duration_ms` abarca coordinación hasta el cierre de auditoría, no el tiempo de renderizado del navegador.
- Origen visible por ficha/corrida: API puntual recuperada por el servidor o JSON declarado. Fecha de actualización del proveedor sigue separada de recuperación.

### Evidencia real

Consulta única de 1 CPU por la ruta NestJS protegida, realizada con cuenta QA admin temporal. La cuenta se retiró; se conservan la referencia pública y su auditoría (creador pasa a `null` por FK `SetNull`). No se usó ni modificó una cuenta real.

- Corrida: `d0128d0f-6f6d-4271-bbdc-c0ea789d5d68`.
- Recuperación: `2026-10-17T04:58:09.902Z` (UTC).
- Ficha: `8914`, **AMD A10-5700**, actualización declarada de origen `2026-05-22T00:11:34.931Z`.
- 1 recibida, 1 válida, 0 rechazada, 0 duplicada, 0 sin TDP. Validez 100% **de una sola ficha**, sin afirmar cobertura general.
- Recuperación 331.743 ms; preparación 0.877 ms; coordinación 365 ms.
- Persistencia y listado autenticado: aprobados. Segundo intento inmediato: 429 antes de acceder al proveedor. Python sin clave interna: 401 antes de acceder al proveedor.
- La ficha es antigua y no prueba stock/precio vigente ni representa los modelos actuales. No se añadió al catálogo del cotizador.

### Verificación actual

- Angular: **48 pruebas**, build y lint; confirmación, espera, doble envío y errores.
- NestJS: **52 pruebas**, build y lint; límites, autenticación interna, procedencia, cooldown, concurrencia y contrato vacío.
- Python: **72 pruebas**, lint e imagen; acceso interno, validaciones, fallos y recuperación sin reintentos. Aviso de deprecación de Starlette/AnyIO aún presente, no fallo.
- `tests/integration/source-recovery.test.mjs`: PostgreSQL/coordinador reales, transporte Python simulado; prueba índice concurrente, espera, prioridad API sobre JSON, fallos e interrupciones. Sus registros QA se retiran. Se añade a CI **sin llamadas a SoloTodo**.
- La integración HTTP previa de muestras y permisos sigue aprobada; el rol cliente no puede usar la ruta nueva.
- La comprobación real anterior fue puntual y no está incluida en CI. El estado remoto de Actions aún requiere commit/push de estos cambios.

Pendientes: confirmar uso recurrente/republicación, mejorar cobertura/muestreo, precios si corresponde, catálogo vinculado, seguridad ampliada, observabilidad global, diseño adaptativo preliminar, staging y cierre de EP2. El flujo CPU real está conectado; la entrega completa no está cerrada.
