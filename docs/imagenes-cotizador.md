# Fotos y referencias del cotizador

Revisión: 16 de octubre de 2026. Las URLs exactas, créditos y enlaces de origen están en `backend/src/catalog/catalog.photos.ts`, `catalog.models.ts` y `catalog.hardware.ts`. Las tarjetas muestran el crédito, sin enlaces que interrumpan la selección. El botón «Foto» abre un visor dentro de la página; no abre pestañas nuevas.

## Qué se está mostrando

| Familia | Procedencia visual | Alcance |
| --- | --- | --- |
| Ryzen 5600G / 5600 / 7800X3D | Utopia Computers, Diit.cz, ITmedia | Presentación/fotografía de referencia del modelo |
| Ryzen 7600 | Rainer Knäpper / Wikimedia Commons | Modelo exacto, Free Art License; autor y enlace de licencia visibles |
| Intel Core 14ª generación | PCBox, Umart, Needy Shop, Sigma | Caja de referencia; presentación comercial puede variar |
| MSI RTX 4060 / 4070 SUPER | MSI | Foto de familia Ventus; la página de 4070 SUPER comparte material visual de la familia |
| ASRock RX 9060 XT Challenger 16GB OC | ASRock | Foto oficial del modelo enlazada; revisión 18/10/2026, URL y ficha en `catalog.recent.ts` |
| Ryzen 5 9600X WOF | Ilustración de respaldo | Sin foto recuperada; no se sustituye por la imagen de otro procesador |
| Sapphire RX 7600 / 7800 XT | Sapphire | Fotografías de PULSE y ficha del modelo concreto |
| Kingston FURY Beast / RGB DDR4/DDR5 | Kingston | Foto de familia, compartida entre capacidades |
| Corsair LPX / Vengeance DDR5 | Corsair | Foto de la familia/producto |
| Kingston A400 / KC3000 | Kingston | Foto de familia; no garantiza etiqueta o capacidad visible |
| Samsung 870 EVO / 990 PRO | Samsung | Foto de familia; algunas capacidades comparten imagen |
| Seagate BarraCuda | Lider | Foto de 1 TB como referencia de familia; las otras capacidades pueden diferir |
| Placas B550M PRO-VDH WIFI, B550-A PRO, PRO B650-S WIFI, MPG B650I EDGE WIFI, PRO B760M-A WIFI DDR4, PRO B760-P WIFI | MSI | Fotografías/renders de sus fichas oficiales; BIOS y QVL se confirman por modelo |
| AK400 / AK620 / LE520 / LE720 | DeepCool | Foto de cada modelo; ventiladores del cooler incluidos, no extras separados |
| Pop Mini Air RGB / Meshify 2 | Fractal Design | Fotografías del modelo; consultar distribución y piezas opcionales |
| 4000D AIRFLOW | Corsair | Foto del gabinete, sin prometer componentes internos incluidos |
| RF120 RGB / GH-01 | DeepCool | Ventilador por unidad y soporte sin iluminación |

## Condiciones y límites

### Fondos de presets

Los tres presets iniciales reutilizan imágenes locales ya incluidas en la galería de JembaTech (`media/portfolio/`). Son referencias visuales de PCs/componentes, no fotografías del contenido exacto de cada preset. Esta aclaración aparece en la previsualización. No se agregaron fotos de terceros ni imágenes generadas para estos fondos. Personalizado ahora es una franja sin fotografía.

### Logos de los selectores de marca

- AMD: SVG blanco del [sitio oficial](https://www.amd.com/content/dam/code/images/header/amd-header-logo.svg).
- Intel y NVIDIA: vectores monocromos de [Simple Icons](https://github.com/simple-icons/simple-icons), archivos `icons/intel.svg` e `icons/nvidia.svg` (distribución CC0 del conjunto; las marcas siguen perteneciendo a sus titulares).
- Copias locales en `frontend/public/media/brand/` para evitar dependencias de carga externas. Se muestran en blanco, sin cambiar su geometría, tanto en verde como en cian.
- Uso identificativo de las opciones del catálogo; no indica patrocinio, certificación ni asociación con JembaTech. Revisar condiciones de marca antes de publicación comercial.

Actualización de los selectores: AMD e Intel usan las imágenes proporcionadas por el usuario (`amd-logo-ruby-red.png` e `intel--600.png`), copiadas sin modificar a `amd-referencia.png` e `intel-referencia.png`. Se desconoce su fuente/licencia original; no se infiere autorización comercial. NVIDIA mantiene el vector local blanco sobre fondo verde `#76b900`. Los tres recuadros tienen proporción 16:9 y el mismo ancho; los colores de marca se conservan también con el tema cian. El encuadre se realiza mediante CSS, sin alterar los originales.

### Fotografías del catálogo

- Las imágenes remotas no se descargan ni se presentan como propiedad de JembaTech.
- Se identifica fuente y, cuando está declarada, licencia. Enlazar una imagen pública **no implica** que tenga licencia libre ni autorización comercial.
- Antes de publicar comercialmente, confirmar permisos de los titulares o reemplazar por fotos propias/de un proveedor autorizado. No se declara una excepción automática por ser un proyecto académico.
- Free Art License de la foto de Ryzen 7600: <https://artlibre.org/licence/lal/en/>. Fuente: <https://commons.wikimedia.org/wiki/File:AMD_Ryzen_5_7600_top_IMGP6773_smial_wp.jpg>.
- Las fotos no se recolorean con el tema: los productos conservan sus colores reales. El entorno, botones y texto sí cambian entre verde y cian.
- Las placas, gabinetes, coolers y accesorios iniciales tienen modelo/fuente en `catalog.hardware.ts`. El cooler incluido depende del CPU y no se representa con una fotografía arbitraria. Las fuentes genéricas recibieron posteriormente referencias visuales explícitas, como se detalla abajo; no se presentan como fotos de un SKU ofertado.
- Los enlaces externos pueden dejar de funcionar; existe respaldo SVG y acceso a la ficha de origen.
- Los precios del catálogo original eran manuales. Estas fotos, por sí solas, **no** constituyen integración de precios/stock. La ampliación posterior se documenta abajo.

## Actualización: fotos de SoloTodo

La [importación al armador](catalogo-solotodo.md) usa `picture_url` de la ficha API, con procedencia visible y formatos raster JPG/JPEG/PNG/WebP/AVIF de `media.solotodo.com`. No se genera ni busca una fotografía por similitud. Puede ser una foto compartida de familia; no equivale a una licencia de republicación. Si falla se mantiene la ilustración de respaldo y una URL corregida permite volver a mostrar la foto. La ampliación se abre en diálogo, no en otra pestaña.

## Módulos individuales y fotos de fuentes (18/10)

Los respaldos RAM usan fotos referenciales de familia Kingston FURY, sin SKU asignado ni oferta inventada; capacidad, velocidad y precio son un perfil orientativo claramente marcado. Los módulos individuales observados conservan sus fotos de SoloTodo. El módulo DDR5 de 64 GB existe en la [familia oficial Kingston](https://www.kingston.com/unitedkingdom/en/memory/search?partid=KF556C40BB-64); confirmar CPU/placa/BIOS/QVL.

Las 57 fuentes estimadas conservan sus IDs y precios. Se añadieron cinco fotos enlazadas de CORSAIR: CX para ATX no modular, TX-M para ATX semimodular, RMx para ATX modular, SF para SFX y SF-L para SFX-L. Procedencia: [catálogo CORSAIR](https://www.corsair.com/us/en/c/psu), [TX650M](https://www.corsair.com/ww/en/p/psu/cp-9020132-ww/tx-m-series-tx650m-650-watt-80-plus-gold-certified-psu-ww-cp-9020132-ww) y [SF850L](https://www.corsair.com/ca/en/p/psu/cp-9020245-na/sf-l-series-sf850l-fully-modular-low-noise-sfx-power-supply-cp-9020245-na). Foto referencial de cableado o formato: no certifica marca, potencia, certificación, conectores ni disponibilidad del perfil seleccionado. Particularmente SFX/SFX-L no representan todas las variantes de cableado. Las tarjetas y el visor lo indican. Imágenes comprobadas HTTP 200; no descargadas al repositorio ni autorizadas automáticamente para uso comercial.
