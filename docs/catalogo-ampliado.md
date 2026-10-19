# Catálogo visible: ampliación del 18/10/2026

Registro histórico de la ampliación manual inicial. Después se implementó la [importación desde SoloTodo](catalogo-solotodo.md), que conserva estos IDs para presets/cotizaciones previas y prioriza los modelos importados en categorías con resultados aptos.

Se agregan 22 opciones a las existentes, sin eliminar identificadores ni cambiar snapshots guardados. Es ampliación manual revisada del cotizador, no importación automática de SoloTodo ni garantía de disponibilidad comercial.

- CPU (8): Ryzen 5 5500 BOX, Ryzen 7 5700X, 5700X3D, Ryzen 5 7500F BOX, Ryzen 7 9700X WOF; Intel i5-12400F Tray, i5-12600KF e i5-14600KF.
- GPU (4): MSI RTX 5060 Ventus 2X OC 8 GB, RTX 5060 Ti Ventus 2X OC PLUS 16 GB; ASRock RX 9060 XT Challenger OC 8 GB y Steel Legend OC 16 GB.
- Placas (2): MSI B650 GAMING PLUS WIFI ATX y MAG B650M MORTAR WIFI Micro-ATX. Ambas con cuatro ranuras DDR5, hasta 256 GB y dos M.2; SATA: cuatro y seis respectivamente. BIOS/QVL y puertos compartidos siguen requiriendo revisión.
- RAM (4 kits de dos módulos): Corsair LPX DDR4-3200 CL16 16 GB, Kingston Beast DDR4-3200 CL16 32 GB, Kingston Beast DDR5-6000 CL36 32 GB y Corsair Vengeance DDR5-6000 CL30 64 GB.
- Discos (4): Kingston NV3 NVMe PCIe 4.0 M.2 2280 de 1/2 TB y Crucial MX500 SATA 2.5 pulgadas de 1/2 TB.

Cada nueva ficha tiene precio **ESTIMADO**, no una oferta consultada: no se amplía silenciosamente el mapeo de ocho precios de [SoloTodo](precios-cotizador.md). Las fotos enlazadas pertenecen a fabricantes; RAM usa familia identificada, CPU/discos nuevos conservan ilustración cuando no se incorpora fotografía identificada. No se descargan ni generan fotos de producto. Los enlaces no equivalen a permiso de republicación.

## Evidencia primaria

- AMD: [5500/5700X y cooler](https://www.amd.com/en/newsroom/press-releases/2022-3-15-amd-launches-the-ultimate-gaming-processor-brings.html), [5700X3D](https://www.amd.com/en/newsroom/press-releases/2024-1-8-amd-reveals-next-gen-desktop-processors-for-extrem.html), [7500F](https://www.amd.com/en/products/processors/desktops/ryzen/7000-series/amd-ryzen-5-7500f.html), [9700X](https://www.amd.com/en/products/processors/desktops/ryzen/9000-series/amd-ryzen-7-9700x.html).
- Intel: [12400F](https://www.intel.com/content/www/us/en/products/sku/134587/intel-core-i512400f-processor-18m-cache-up-to-4-40-ghz/specifications.html), [12600KF](https://www.intel.com/content/www/us/en/products/sku/134590/intel-core-i512600kf-processor-20m-cache-up-to-4-90-ghz/specifications.html), [14600KF](https://www.intel.com/content/www/us/en/products/sku/236778/intel-core-i5-processor-14600kf-24m-cache-up-to-5-30-ghz/specifications.html). Potencia del perfil Intel: turbo máximo publicado, no potencia base. AMD usa margen manual de planificación, separado del TDP declarado; no se afirma consumo medido.
- MSI: [5060](https://www.msi.com/Graphics-Card/GeForce-RTX-5060-8G-VENTUS-2X-OC/Specification), [5060 Ti](https://www.msi.com/Graphics-Card/GeForce-RTX-5060-Ti-16G-VENTUS-2X-OC-PLUS/Specification), [B650 GAMING PLUS](https://www.msi.com/Motherboard/B650-GAMING-PLUS-WIFI/Specification), [B650M MORTAR](https://www.msi.com/Motherboard/MAG-B650M-MORTAR-WIFI/Specification). Fotografías identificadas mediante enlaces de sus páginas oficiales de producto.
- ASRock: [Challenger 8 GB](https://www.asrock.com/Graphics-Card/AMD/Radeon%20RX%209060%20XT%20Challenger%208GB%20OC/index.us.asp), [Steel Legend 16 GB](https://www.asrock.com/Graphics-Card/AMD/Radeon%20RX%209060%20XT%20Steel%20Legend%2016GB%20OC/index.us.asp). Fuente recomendada y dimensiones oficiales; 200 W es reserva de planificación, no TBP certificado de esas versiones OC. Foto exacta de cada página.
- Kingston: [DDR4](https://www.kingston.com/datasheets/KF432C16BBK2_32.pdf), [DDR5 KF560C36BBE2K2-32](https://www.kingston.com/datasheets/KF560C36BBE2K2-32.pdf), [NV3](https://www.kingston.com/en/ssd/nv3-nvme-pcie-ssd). Se usa el kit DDR5 de reemplazo, no la referencia anterior descontinuada. NVMe está declarado por fabricante, no inferido del formato M.2.
- Corsair: [LPX 16 GB](https://www.corsair.com/us/en/p/memory/cmk16gx4m2b3200c16/vengeancea-lpx-16gb-2-x-8gb-ddr4-dram-3200mhz-c16-memory-kit-black-cmk16gx4m2b3200c16), [Vengeance 64 GB](https://www.corsair.com/ww/en/p/memory/cmk64gx5m2b6000c30/vengeance-64gb-2x32gb-ddr5-dram-6000mt-s-cl30-memory-kit-black-cmk64gx5m2b6000c30).
- Crucial: [MX500, formatos y números de parte](https://content.crucial.com/content/dam/crucial/ssd-products/mx500/flyer/crucial-mx500-ssd-productflyer-en.pdf). Solo variantes SSD1 SATA 2.5 pulgadas, no SSD4 M.2 SATA.

## Qué hace «¿Para qué lo usarás?»

No segmenta, filtra ni ordena piezas por uso; tampoco recomienda modelos automáticamente. Se guarda en la cotización y viaja al análisis de Python. La regla específica actual muestra advertencia si hay RAM elegida, suma menos de 16 GB y el uso es gaming, programación o edición. Cada advertencia descuenta 10 puntos del puntaje de revisión, sin impedir guardar por sí sola. Oficina/estudio no activan esa regla. Compatibilidad y filtros manuales siguen funcionando independientemente del uso.

Se agrega esta explicación junto al selector. Pruebas cubren los cinco usos con 8/16 GB, invariancia de precio y posibilidad de guardar; catálogo sin IDs duplicados, categorías nuevas, kits y selección visible sin recorte por uso.

## Validación local

- Backend: lint, compilación y 116 pruebas aprobadas. Frontend: lint, compilación y 59 pruebas aprobadas. Python: 171 pruebas aprobadas y Ruff aprobado (EXE002 excluido solo en montaje Windows); permanece aviso previo de Starlette/TestClient sobre httpx.
- Backend local reconstruido sin recrear PostgreSQL; salud de frontend, proxy, Nest, Python y DB correcta.
- Catálogo HTTP sin legacy: 17 CPU, 10 gráficas (incluye integrada), 8 placas, 14 RAM y 23 discos. Los filtros por marca, tipo y compatibilidad pueden reducir lo visible en cada paso; esos conteos no implican modelos con precio observado.
- Preview HTTP AM5/9700X + 5060 Ti + B650 GAMING PLUS + kit DDR5 32 GB + NV3: guardable, sin incidencias. Tres kits de dos módulos en placa de cuatro ranuras: bloqueado. No se guardó ninguna cotización de prueba.
- 12 cotizaciones antes/después, misma huella SHA-256 `b9255952d4a5368a87824ed198d70b4c5695a043b87f88dc1f8562b66f02e9a2`. No se imprimieron datos privados.
- Sin commit, push, despliegue público ni nueva ejecución remota de Actions. No se hicieron nuevas consultas de precios al proveedor en esta ampliación; los nuevos modelos mantienen estimación explícita.
