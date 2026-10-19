# Catálogo del armador desde SoloTodo

Ampliación local del 18/10/2026. No es un catálogo completo del proveedor ni una sincronización pública autorizada. La carga es finita y bajo demanda; publicar o programar consultas sigue pendiente de condiciones de reutilización. No se modifica ninguna cotización guardada.

## Alcance acordado

| Categoría | Selección | Tope publicado |
| --- | --- | ---: |
| CPU | Intel de escritorio desde 11.ª, Core Ultra de escritorio; Ryzen 5000/7000/9000 | 35 |
| GPU | RTX 30/40/50 de gamas 60–80; RX 6000/7000/9000 seleccionadas | 30 |
| RAM | DIMM DDR4/DDR5, 8/16/32/64 GB por producto, módulos y kits | 20 |
| Placas | AM4/AM5/LGA1200/LGA1700/LGA1851, ATX/Micro-ATX/Mini-ITX | 20 |
| Gabinetes | Selección Corsair/NZXT/Montech/Lian Li/Cooler Master; tamaños y colores variados | 15 |

Son **topes**, no cantidades que se rellenan con estimaciones. Solo entran fichas con foto identificada y alguna oferta apta en la página consultada. No encontrarla no demuestra que no exista stock en todo el mercado. La búsqueda acotada puede devolver menos modelos o variantes de una familia; no se declara cobertura exhaustiva de cada generación.

Portátiles, CPU BGA/móviles, SO-DIMM, servidores, Xeon y Threadripper quedan fuera. RAM requiere formato DIMM explícito, no basta que el nombre no diga portátil. El socket y el nombre CPU se revisan en Python y otra vez en Nest. Los modelos concretos y cuotas están en los dos manifiestos `catalog_scope.json`/`catalog-scope.json`, cuya igualdad comprueba una prueba.

## Recorrido de adquisición

1. ADMIN confirma una familia en «Fuentes y calidad → Importar modelos con foto y precio», o ejecuta la carga local explícita.
2. Nest crea auditoría y aplica la misma exclusión PostgreSQL y espera de 60 s que las consultas técnicas/precios anteriores.
3. Python consulta una página de hasta 25 candidatas CPU (orden del buscador) o 10 de otra categoría (`-id`, referencias incorporadas más recientemente). Prioriza nombres coincidentes y presentaciones no Tray. Ningún orden garantiza lanzamiento, vigencia o disponibilidad.
4. Valida categoría, familia, escritorio, foto y campos. Consulta ofertas de hasta cinco candidatas, una página de hasta cinco ofertas por candidata; máximo seis peticiones por acción. Las restantes quedan registradas como `candidate_limit` o `target_quota`. No sigue `next`, URLs de tiendas ni redirecciones. Sin reintentos; una denegación o límite detiene la operación.
5. Ofertas: CLP, nuevo, visible, disponibilidad explícita, sin plan/bundle/cupón, fecha con zona de las últimas 24 h y precios enteros coherentes. Se toma el menor **precio normal entre las ofertas aptas de esa página**, no el mínimo global. Oferta/descuento se informa aparte.
6. Nest valida de nuevo identidad, URL de foto, socket/RAM, cantidades, oferta y correlación. Persiste el resultado en `SourceRun.metrics` (`kind: armador-catalog`) antes de publicar en caché.
7. El armador lee PostgreSQL/caché a través de Nest; abrir, filtrar o cambiar piezas no consulta SoloTodo. Reiniciar restaura auditorías válidas recientes; no requiere otra adquisición externa.

Un lote vacío válido retira las ofertas de esa familia, conserva sus IDs históricos ocultos y no inventa un precio. Un fallo de transporte/persistencia conserva la versión anterior. Vencimiento: 24 h desde la más antigua entre consulta y actualización de oferta; se bloquea cotizar el producto como si fuera gratis o con un precio vigente. Las consultas de precios de los ocho mapeos anteriores siguen separadas.

Cuando una categoría ya tiene modelos importados, sus referencias manuales se conservan ocultas salvo selección previa/preset. No se borran IDs, snapshots ni precios históricos. Gráfica integrada, almacenamiento, refrigeración, fuentes y accesorios mantienen su alcance anterior; no se presentan como importados por esta ampliación.

Excepción posterior solicitada para personalización: RAM completa capacidades faltantes con perfiles individuales estimados y fuentes conserva todos sus perfiles con fotos referenciales de fabricante; detalles al final. No se presentan como ofertas importadas de SoloTodo.

## Fotos y presentación

- Se utiliza `picture_url` asignada por la API a la ficha, no una foto buscada por similitud ni una imagen generada. Puede ser una fotografía compartida de familia; la tarjeta lo indica.
- Solo HTTPS de `media.solotodo.com/media/products/`, nombre acotado y formatos JPG/JPEG/PNG/WebP/AVIF. No SVG, host arbitrario, credenciales, consultas ni rutas de navegación.
- La imagen conserva proporción y área uniforme. Se mantiene la ampliación en diálogo, sin navegar a otra página; pulsar la tarjeta alterna selección. Si la foto falla, se utiliza la ilustración existente sin afirmar que sea una foto.
- Los enlaces de foto no equivalen a permiso de republicación. No se descargan imágenes de producto al repositorio ni textos comerciales/HTML del proveedor.

## Compatibilidad: datos conocidos y pendientes

No convertir ausencias en ceros. La API no siempre declara capacidad RAM máxima de la placa, formato de PSU, radiadores o montaje simultáneo de ventiladores. Esos campos se omiten, se muestran «Por confirmar» y el análisis informa **Revisión parcial · confirmar montaje**, no «Compatible con el perfil». Se puede guardar una cotización preliminar con esos avisos; no constituye compra ni certificación física. Incompatibilidades conocidas siguen bloqueando.

El consumo no es importación de un máximo eléctrico certificado: CPU Intel reserva manual de 300 W (i9/Ultra 9), 253 W (i7/Ultra 7) o 200 W (otros); AMD `ceil(TDP × 1,5)`; GPU `ceil(TDP de chip × 1,25)`. Son presupuestos de planificación explícitos, con la política de margen del evaluador, no mediciones ni TDP/TBP del ensamblador. RAM: 4 W por módulo; placa: 45 W. Se muestra el aviso correspondiente. El mínimo de PSU del ensamblador GPU permanece por confirmar si no está declarado.

RAM DDR se deriva de plataforma conocida: AM4/LGA1200 DDR4; AM5/LGA1851 DDR5; LGA1700 DDR4 o DDR5 según placa. CPU/generación/socket se contrastan en Python y Nest. BIOS, QVL, combinaciones de kits y perfiles de memoria siguen sujetos a revisión. Cooler stock solo si la ficha lo declara; Tray/WOF nunca se considera incluido, aun si la ficha de familia lo sugiere. Gabinetes con PSU incluida o desconocida se excluyen de la importación nueva. Se añadieron LGA1200 y soporte LGA1851 de las versiones/kit indicados por DeepCool; confirmar la presentación física, no asumir que una caja antigua trae todos los anclajes.

Fuentes primarias de montaje complementario: [AK400 actualizado](https://www.deepcool.com/products/Cooling/cpuaircoolers/AK400-Performance-CPU-Cooler-1851-1700-AM5/2024/15222.shtml), [AK620 actualizado](https://www.deepcool.com/products/Cooling/cpuaircoolers/AK620-High-Performance-CPU-Cooler-1851-1700-AM5/2024/13067.shtml), [LE720](https://deepcool.com/products/Cooling/cpuliquidcoolers/LE720-360mm-Liquid-CPU-Cooler-1851-1700-AM5/2024/16983.shtml). LE520 conserva solo los sockets verificados en su ficha anterior; no se extendió a LGA1851 por analogía.

## Operación y pruebas

Desde la raíz del proyecto, con servicios locales y piloto habilitados:

```powershell
node scripts/import-solotodo-catalog.mjs --live --target cpu-intel-14
# Carga finita: familias pendientes, alternadas por categoría, con espera global.
node scripts/import-solotodo-catalog.mjs --live --all
```

La carga usa un contenedor auxiliar sin publicar puertos; una cuenta QA propia temporal autentica las acciones y se retira al finalizar. La carga no se inicia por importar el módulo y no se programa para después. Resume familias no consultadas/antiguas; una selección vacía se vuelve a considerar si cambió su consulta acotada o el contrato de fotos/normalización. Un error de proveedor detiene el proceso, sin bucles de reintento. Una petición externa o una familia puede no llenar su cuota.

Pruebas sin red: exclusiones de escritorio, memoria por kit, imagen/URL, contrato/precio y campos faltantes. Integración QA separada con PostgreSQL real: 401/403, DTO, habilitación, auditoría, restauración, oferta ausente, revisión con Python y espera compartida. El workflow incorpora esa integración sin consultar al proveedor. No se ejecuta en la base principal ni se envejecen sus auditorías para saltar esperas.

El compose QA independiente recibe `CATALOG_QA_DATABASE_IMAGE`, `CATALOG_QA_DB_PASSWORD`, `CATALOG_QA_DATABASE_URL` y `CATALOG_QA_JWT_SECRET` desde el entorno, sin credenciales de ejemplo en Git. La URL debe apuntar exclusivamente a `database:5432/jemba_catalog_qa` del proyecto temporal, usuario `catalog_qa`, con su contraseña temporal. Iniciar con `up -d --wait` para verificar salud antes de las pruebas. Nunca usar el volumen ni la URL de la base principal.

## Corte real local del 18/10/2026

La carga finita terminó, sin consultas activas ni cuentas QA de importación pendientes. Resultado visible, no datos sintéticos:

| Categoría | Modelos publicados | Tope |
| --- | ---: | ---: |
| CPU | 25 | 35 |
| GPU | 12 | 30 |
| RAM | 7 | 20 |
| Placas | 13 | 20 |
| Gabinetes | 5 | 15 |
| Total | **62** | **120** |

Ejemplos: Ryzen 5500/5600/5600G/5700, 7600 y 9000; Intel i3/i5/i7/i9 y Core Ultra; RTX y Radeon; DIMM DDR4/DDR5; B550/B650/B760/B860; gabinetes Cooler Master, Lian Li y Corsair. Solo escritorio. Las variantes son presentaciones distintas de la ficha, no necesariamente 62 chips/familias diferentes.

No se llenaron cuotas con productos manuales. Las selecciones i9-11900, RTX 3070/4060/4070, RX 6600, B560, Corsair DDR4, NZXT, Montech y Ryzen 5900/5950 no aportaron una oferta apta en la revisión acotada. Esto **no demuestra falta de stock global** ni cobertura de toda la generación Intel 11.ª. Sus incidencias quedan en la auditoría.

Corridas reales de ejemplo, todas `SUCCEEDED`: CPU 5600 `a3c61069-0c55-4f68-8058-4bf33b0937ea` (2 productos); GPU RTX 5060 `205f5c2b-90cf-4779-b734-b387e86248e6` (3); RAM Corsair DDR5 `0b2861a1-5905-4a52-b172-14ea11787cea` (4); B550 `2fa9be0e-aa05-4a25-a4b6-75a2ca9fbc08` (4); Cooler Master `41ecf4c1-4340-49fe-8796-2f926fc2b8af` (2). El contrato anterior de estas últimas corridas se conserva para restauración; las consultas nuevas usan v3.

Verificaciones finales:

- 62/62 imágenes respondieron correctamente: 44 con MIME de imagen y 18 con firma raster comprobada mediante lectura inicial acotada, porque el CDN declara archivo genérico. Sin almacenar las imágenes en Git. No certifica que la fotografía compartida de familia represente la presentación exacta ni su licencia.
- Navegador: tarjetas de ancho uniforme, fotos AMD y gabinetes, selección del modelo importado y ampliación en diálogo sin otra pestaña. Las referencias manuales seleccionadas por un preset se conservan hasta reemplazarlas; no se convierten por similitud en productos importados.
- Reinicio real del backend: las mismas 62 identidades se restauraron desde PostgreSQL, sin otra adquisición a SoloTodo. Salud de frontend/proxy, NestJS, PostgreSQL y FastAPI correcta.
- Vistas previas completas Intel i5-12400 y AMD 5600G con placa/RAM/gabinete importados: `can_save: true`, sin piezas faltantes, revisión parcial y avisos explícitos de montaje. No se guardaron esas pruebas como cotizaciones.
- Las 12 cotizaciones existentes conservaron la misma huella anónima antes/después. Se retiraron exclusivamente las cuentas y bases temporales QA creadas para probar; no el volumen principal.
- NestJS: **134 pruebas**; Python: **197**; Angular: **63**; controles Node/documento: **27**. Lint/build de backend y frontend, Ruff, Bandit, YAML y diff sin errores. Se conserva el aviso de deprecación del TestClient de Starlette; no es fallo de pruebas.
- Integraciones aisladas con PostgreSQL real de importación y precios aprobadas sobre las imágenes finales, tras esperar salud. Sin red externa para esas pruebas. La adquisición real anterior se distingue de sus fixtures sintéticos.

Cambios locales: **no se hizo commit/push ni se ejecutó una CI remota nueva**. Reutilización/publicación, actualización recurrente, staging y release EP2 permanecen pendientes. No se garantiza catálogo completo ni precios/stock siempre vigentes.

## Ajuste posterior: elegir por módulo y explorar fuentes

Nueva vista RAM: 8/16/32 GB DDR4 y 8/16/32/64 GB DDR5, siempre una unidad por producto nuevo. Los 64 GB DDR4 se pueden planificar con dos módulos de 32 GB; no se introduce RAM RDIMM de servidor. La API recuperada incluía tres kits y cuatro módulos individuales: los kits se conservan históricos/ocultos, no se dividen ni se cambia su precio. El corte actual muestra cuatro módulos observados y tres perfiles estimados para capacidades faltantes (DDR4 8/32 y DDR5 8). Presets nuevos usan dos módulos individuales y eligen la oferta equivalente cuando existe.

Los siete IDs de respaldo `ram-module-*` son permanentes aunque una oferta equivalente los oculte. Precio estimado: menor precio normal por GB de los módulos individuales vigentes del mismo DDR × capacidad, redondeado a miles; no se usan kits ni precios vencidos como anclas. Es extrapolación orientativa, **no precio de un SKU concreto ni garantía de proporcionalidad**. Sin anclas, base manual de planificación 2200 CLP/GB DDR4 y 2900 CLP/GB DDR5, nunca etiquetada como oferta. Foto de familia y velocidad referencial, SKU/latencias/QVL por confirmar. Las cotizaciones existentes no se reescriben.

Fuentes: 57 perfiles existentes, mismos tipos/potencias/precios, ahora con [fotos referenciales de fabricante](imagenes-cotizador.md). El paso abre con todas las potencias y compatibilidades señaladas; no se prefiltra a la mínima recomendada. Los avisos extensos de evaluación/montaje se muestran únicamente en el paso 10, «Resumen», no bajo cada selector ni de nuevo al guardar. Filtros, avisos cortos por tarjeta y bloqueos de incompatibilidades reales siguen activos.

Verificación de este ajuste: 139 pruebas NestJS, 198 Python y 68 Angular; lint/build de ambos servicios web y Ruff sin errores. HTTP local: siete capacidades DDR/tamaño cubiertas por módulos, 57/57 fuentes con foto y siete URLs de imagen únicas verificadas HTTP 200. Comprobación visual de módulos, todas las potencias y avisos en Resumen; sin guardar cotizaciones de prueba.
