# Fotos y referencias del cotizador

Revisión: 16 de octubre de 2026. Las URLs exactas, créditos y enlaces de origen están en `backend/src/catalog/catalog.photos.ts`, `catalog.models.ts` y `catalog.hardware.ts`. Las tarjetas muestran el crédito, sin enlaces que interrumpan la selección. El botón «Foto» abre un visor dentro de la página; no abre pestañas nuevas.

## Qué se está mostrando

| Familia | Procedencia visual | Alcance |
| --- | --- | --- |
| Ryzen 5600G / 5600 / 7800X3D | Utopia Computers, Diit.cz, ITmedia | Presentación/fotografía de referencia del modelo |
| Ryzen 7600 | Rainer Knäpper / Wikimedia Commons | Modelo exacto, Free Art License; autor y enlace de licencia visibles |
| Intel Core 14ª generación | PCBox, Umart, Needy Shop, Sigma | Caja de referencia; presentación comercial puede variar |
| MSI RTX 4060 / 4070 SUPER | MSI | Foto de familia Ventus; la página de 4070 SUPER comparte material visual de la familia |
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
- Las nuevas placas, gabinetes, coolers y accesorios tienen modelo/fuente en `catalog.hardware.ts`. Los perfiles antiguos y las fuentes genéricas no reciben fotos de un modelo ajeno. El cooler incluido depende del CPU y no se representa con una fotografía arbitraria.
- Los enlaces externos pueden dejar de funcionar; existe respaldo SVG y acceso a la ficha de origen.
- Los precios CLP son manuales. Estas fotos **no** constituyen integración de precios/stock ni extracción automatizada para EP2.
