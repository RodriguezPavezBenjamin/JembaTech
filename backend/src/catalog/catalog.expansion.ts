import { CatalogProduct } from './catalog.types';

// Ampliación revisada en fichas primarias. Precios base de planificación,
// expresamente ESTIMADOS; no son ofertas recuperadas ni stock comprobado.
export const EXPANDED_PRODUCTS: CatalogProduct[] = [];
const planning = 'El consumo del perfil es una estimación de planificación, no una medición ni el TDP. Confirmar BIOS, presentación, límites de potencia y montaje.';
const amdRoot = 'https://www.amd.com/en/products/processors/desktops/ryzen/';

for (const cpu of [
  { id: '5500', model: 'Ryzen 5 5500 · BOX', socket: 'AM4', ram: ['DDR4'], cores: 6, threads: 12, integrated: false, stock: true, power: 88, tdp: 65, price: 89990, path: '5000-series/amd-ryzen-5-5500.html' },
  { id: '5700x', model: 'Ryzen 7 5700X · sin cooler', socket: 'AM4', ram: ['DDR4'], cores: 8, threads: 16, integrated: false, stock: false, power: 88, tdp: 65, price: 169990, path: '5000-series/amd-ryzen-7-5700x.html' },
  { id: '5700x3d', model: 'Ryzen 7 5700X3D · sin cooler', socket: 'AM4', ram: ['DDR4'], cores: 8, threads: 16, integrated: false, stock: false, power: 142, tdp: 105, price: 249990, path: '5000-series/amd-ryzen-7-5700x3d.html' },
  { id: '7500f', model: 'Ryzen 5 7500F · BOX', socket: 'AM5', ram: ['DDR5'], cores: 6, threads: 12, integrated: false, stock: true, power: 142, tdp: 65, price: 159990, path: '7000-series/amd-ryzen-5-7500f.html' },
  { id: '9700x', model: 'Ryzen 7 9700X · WOF', socket: 'AM5', ram: ['DDR5'], cores: 8, threads: 16, integrated: true, stock: false, power: 142, tdp: 65, price: 329990, path: '9000-series/amd-ryzen-7-9700x.html' },
]) {
  EXPANDED_PRODUCTS.push({ id: `cpu-${cpu.id}`, category: 'cpu', name: `AMD ${cpu.model}`,
    description: `${cpu.socket} · ${cpu.cores} núcleos / ${cpu.threads} hilos · ${cpu.integrated ? 'gráfica integrada' : 'requiere gráfica dedicada'} · ${cpu.stock ? 'cooler de la presentación BOX' : 'cooler separado'}`,
    price: cpu.price, icon: 'cpu', imageSource: amdRoot + cpu.path,
    specs: { brand: 'AMD', socket: cpu.socket, ramTypes: cpu.ram, cores: cpu.cores, threads: cpu.threads,
      integrated: cpu.integrated, stockCooler: cpu.stock, power: cpu.power, declaredTdpWatts: cpu.tdp, mountNote: planning } });
}
for (const cpu of [
  { id: 'i5-12400f', model: 'Core i5-12400F · Tray', cores: 6, threads: 12, power: 117, price: 119990, path: '134587/intel-core-i512400f-processor-18m-cache-up-to-4-40-ghz' },
  { id: 'i5-12600kf', model: 'Core i5-12600KF', cores: 10, threads: 16, power: 150, price: 179990, path: '134590/intel-core-i512600kf-processor-20m-cache-up-to-4-90-ghz' },
  { id: 'i5-14600kf', model: 'Core i5-14600KF', cores: 14, threads: 20, power: 181, price: 269990, path: '236778/intel-core-i5-processor-14600kf-24m-cache-up-to-5-30-ghz' },
]) {
  EXPANDED_PRODUCTS.push({ id: `cpu-${cpu.id}`, category: 'cpu', name: `Intel ${cpu.model}`,
    description: `LGA1700 · ${cpu.cores} núcleos / ${cpu.threads} hilos · sin gráfica integrada · cooler separado`,
    price: cpu.price, icon: 'cpu', imageSource: `https://www.intel.com/content/www/us/en/products/sku/${cpu.path}/specifications.html`,
    specs: { brand: 'Intel', socket: 'LGA1700', ramTypes: ['DDR4', 'DDR5'], cores: cpu.cores, threads: cpu.threads,
      integrated: false, stockCooler: false, power: cpu.power,
      mountNote: 'El perfil usa la potencia turbo máxima publicada por Intel, no su potencia base. Confirmar BIOS y límites de potencia; la presentación Tray no incluye cooler. RAM DDR4 o DDR5 según placa, nunca ambas.' } });
}

const gpuPhotos: Record<string, string> = {
  'msi-5060-8': 'https://storage-asset.msi.com/global/picture/image/feature/vga/NVIDIA/new-gen/gb206-250-8g-ventus-oc/kv/msi-8g-ventus-2x-oc-kv-v1.png',
  'msi-5060ti-16': 'https://storage-asset.msi.com/global/picture/image/feature/vga/NVIDIA/new-gen/gb206-300-16g-ventus-2x-plus/msi-206-ventus-2x-plus-kv-new.png',
  'asrock-9060xt-8': 'https://www.asrock.com/Graphics-Card/photo/Radeon%20RX%209060%20XT%20Challenger%208GB%20OC%28M1%29.png',
  'asrock-9060xt-steel-16': 'https://www.asrock.com/Graphics-Card/photo/Radeon%20RX%209060%20XT%20Steel%20Legend%2016GB%20OC%28M1%29.png',
};
for (const gpu of [
  { id: 'msi-5060-8', name: 'MSI RTX 5060 Ventus 2X OC · 8 GB', brand: 'NVIDIA', vram: 8, power: 145, minPsu: 550, length: 197, price: 349990, source: 'https://www.msi.com/Graphics-Card/GeForce-RTX-5060-8G-VENTUS-2X-OC/Specification' },
  { id: 'msi-5060ti-16', name: 'MSI RTX 5060 Ti Ventus 2X OC PLUS · 16 GB', brand: 'NVIDIA', vram: 16, power: 180, minPsu: 600, length: 227, price: 499990, source: 'https://www.msi.com/Graphics-Card/GeForce-RTX-5060-Ti-16G-VENTUS-2X-OC-PLUS/Specification' },
  { id: 'asrock-9060xt-8', name: 'ASRock RX 9060 XT Challenger OC · 8 GB', brand: 'AMD', vram: 8, power: 200, minPsu: 550, length: 249, price: 329990, source: 'https://www.asrock.com/Graphics-Card/AMD/Radeon%20RX%209060%20XT%20Challenger%208GB%20OC/index.us.asp' },
  { id: 'asrock-9060xt-steel-16', name: 'ASRock RX 9060 XT Steel Legend OC · 16 GB', brand: 'AMD', vram: 16, power: 200, minPsu: 550, length: 298, price: 429990, source: 'https://www.asrock.com/Graphics-Card/AMD/Radeon%20RX%209060%20XT%20Steel%20Legend%2016GB%20OC/index.us.asp' },
]) {
  EXPANDED_PRODUCTS.push({ id: `gpu-${gpu.id}`, category: 'gpu', name: gpu.name,
    description: `${gpu.brand} · ${gpu.vram} GB · ${gpu.length} mm · 1 × 8-pin · PSU fabricante: ${gpu.minPsu} W`,
    price: gpu.price, icon: 'gpu', image: gpuPhotos[gpu.id], imageSource: gpu.source,
    imageLabel: `Foto del modelo · ${gpu.brand === 'NVIDIA' ? 'MSI' : 'ASRock'}`,
    specs: { brand: gpu.brand, integrated: false, vramGb: gpu.vram, lengthMm: gpu.length, power: gpu.power, minPsu: gpu.minPsu, pcie8: 1, twelveV: 0,
      mountNote: gpu.brand === 'NVIDIA' ? 'Potencia, dimensiones y fuente recomendada según ficha MSI. Confirmar la versión exacta OC/PLUS y espacio ocupado.' : 'Se reservan 200 W para planificación, no como TBP certificado de esta versión OC. Confirmar espesor, espacio libre, ventilación y conectores.' } });
}

for (const board of [
  { id: 'b650-gaming-plus', model: 'B650 GAMING PLUS WIFI', form: 'ATX', sata: 4, price: 199990, slug: 'B650-GAMING-PLUS-WIFI' },
  { id: 'b650m-mortar', model: 'MAG B650M MORTAR WIFI', form: 'Micro-ATX', sata: 6, price: 219990, slug: 'MAG-B650M-MORTAR-WIFI' },
]) {
  EXPANDED_PRODUCTS.push({ id: `board-msi-${board.id}`, category: 'board', name: `MSI ${board.model}`,
    description: `AM5 · DDR5 · ${board.form} · Wi-Fi 6E`, price: board.price, icon: 'board', imageSource: `https://www.msi.com/Motherboard/${board.slug}/Specification`,
    image: board.id === 'b650-gaming-plus'
      ? 'https://storage-asset.msi.com/global/picture/image/feature/mb/B650/B650-GAMING-PLUS-WIFI/modelblock-gaming-pd.png'
      : 'https://storage-asset.msi.com/global/picture/image/feature/mb/B650M/MAG-B650M-MORTAR-WIFI/icon-mag-b650m-mortar-wifi.png',
    imageLabel: 'Foto del modelo · MSI',
    specs: { brand: 'MSI', socket: 'AM5', ram: 'DDR5', form: board.form, chipset: 'B650', ramSlots: 4, maxRam: 256, m2: 2, sata: board.sata, cpuEps: 2, wifi: true, wireless: 'Wi-Fi 6E · Bluetooth 5.3', lan: '2.5 GbE',
      mountNote: 'Confirmar BIOS y QVL. Las ranuras y velocidades dependen del CPU; los conteos no garantizan todos los puertos simultáneos. Estos perfiles no incluyen Ryzen 8000/8500.' } });
}

const furyPhoto = (ddr: string) => `https://media.kingston.com/kingston/product-comparison/ktc-comp-chart-fury-beast-${ddr.toLowerCase()}_tn.png`;
for (const ram of [
  { id: 'corsair-lpx-kit-16', name: 'Corsair Vengeance LPX', ram: 'DDR4', capacity: 16, speed: 3200, cl: 16, part: 'CMK16GX4M2B3200C16', price: 39990, source: 'https://www.corsair.com/us/en/p/memory/cmk16gx4m2b3200c16/vengeancea-lpx-16gb-2-x-8gb-ddr4-dram-3200mhz-c16-memory-kit-black-cmk16gx4m2b3200c16', image: 'https://assets.corsair.com/image/upload/c_pad,q_85,h_360,w_360,f_auto/products/Memory/CMK8GX4M1E3200C16/Gallery/VENG_LPX_BLK_01.webp' },
  { id: 'fury-ddr4-kit-32', name: 'Kingston FURY Beast', ram: 'DDR4', capacity: 32, speed: 3200, cl: 16, part: 'KF432C16BBK2/32', price: 69990, source: 'https://www.kingston.com/datasheets/KF432C16BBK2_32.pdf', image: furyPhoto('DDR4') },
  { id: 'fury-ddr5-kit-32', name: 'Kingston FURY Beast', ram: 'DDR5', capacity: 32, speed: 6000, cl: 36, part: 'KF560C36BBE2K2-32', price: 104990, source: 'https://www.kingston.com/datasheets/KF560C36BBE2K2-32.pdf', image: furyPhoto('DDR5') },
  { id: 'corsair-ddr5-kit-64', name: 'Corsair Vengeance', ram: 'DDR5', capacity: 64, speed: 6000, cl: 30, part: 'CMK64GX5M2B6000C30', price: 219990, source: 'https://www.corsair.com/ww/en/p/memory/cmk64gx5m2b6000c30/vengeance-64gb-2x32gb-ddr5-dram-6000mt-s-cl30-memory-kit-black-cmk64gx5m2b6000c30', image: 'https://assets.corsair.com/image/upload/c_pad,q_85,h_360,w_360,f_auto/products/Memory/vengeance-ddr5-blk-config/Gallery/VENGEANCE_DDR5_BLK_01_2up.webp' },
]) {
  EXPANDED_PRODUCTS.push({ id: `ram-${ram.id}`, category: 'ram', name: `${ram.name} · ${ram.capacity} GB (2 × ${ram.capacity / 2})`,
    description: `${ram.ram} · ${ram.speed} MT/s · CL${ram.cl} · kit de fábrica · sin RGB`, price: ram.price, icon: 'ram', image: ram.image, imageSource: ram.source, imageLabel: 'Foto de familia · no garantiza capacidad visible',
    specs: { brand: ram.name.startsWith('Corsair') ? 'Corsair' : 'Kingston', ram: ram.ram, capacityGb: ram.capacity, modules: 2, speed: ram.speed, casLatency: ram.cl, rgb: false, power: 8, partNumber: ram.part,
      mountNote: 'La velocidad anunciada requiere el perfil XMP/EXPO compatible y no se garantiza con cuatro módulos o kits mezclados. Confirmar QVL; consumo del perfil estimado.' } });
}

for (const capacity of [1000, 2000]) {
  EXPANDED_PRODUCTS.push({ id: `drive-kingston-nv3-${capacity}`, category: 'storage', name: `Kingston NV3 · ${capacity / 1000} TB · 2280`,
    description: 'SSD NVMe · PCIe 4.0 x4 · M.2 2280 · por unidad', price: capacity === 1000 ? 69990 : 119990, icon: 'nvme', imageSource: 'https://www.kingston.com/en/ssd/nv3-nvme-pcie-ssd',
    specs: { brand: 'Kingston', family: 'NV3', capacityGb: capacity, kind: 'NVMe', generation: 4, power: 10, partNumber: `SNV3S/${capacity}G`, mountNote: 'Variante M.2 2280, no 2230. El fabricante confirma NVMe; no se deduce solo del formato. Verificar ranura PCIe y su velocidad; consumo de planificación estimado.' } });
  EXPANDED_PRODUCTS.push({ id: `drive-crucial-mx500-${capacity}`, category: 'storage', name: `Crucial MX500 · ${capacity / 1000} TB · 2.5 pulgadas`,
    description: 'SSD SATA 6 Gb/s · 2.5 pulgadas · no M.2 · por unidad', price: capacity === 1000 ? 79990 : 139990, icon: 'sata', imageSource: 'https://content.crucial.com/content/dam/crucial/ssd-products/mx500/flyer/crucial-mx500-ssd-productflyer-en.pdf',
    specs: { brand: 'Crucial', family: 'MX500', capacityGb: capacity, kind: 'SATA', generation: 0, power: 5, partNumber: `CT${capacity}MX500SSD1`, mountNote: 'Variante SATA 2.5 pulgadas SSD1; no confundir con SSD4 M.2 SATA. Requiere bahía, puerto y alimentación SATA. Consumo del perfil estimado.' } });
}
