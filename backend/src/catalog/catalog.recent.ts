import { CatalogProduct } from './catalog.types';

// Especificaciones revisadas en AMD/ASRock el 18/10/2026; precios base estimados.
// Las ofertas consultadas sustituyen solo el precio, no estas reglas de montaje.
export const RECENT_PRODUCTS: CatalogProduct[] = [
  {
    id: 'cpu-9600x', category: 'cpu', name: 'AMD Ryzen 5 9600X · WOF',
    description: 'AM5 · 6 núcleos / 12 hilos · DDR5 · gráfica integrada · sin cooler',
    price: 249990, icon: 'cpu',
    imageSource: 'https://www.amd.com/en/products/processors/desktops/ryzen/9000-series/amd-ryzen-5-9600x.html',
    specs: { brand: 'AMD', socket: 'AM5', ramTypes: ['DDR5'], integrated: true, stockCooler: false,
      power: 142, declaredTdpWatts: 65, partNumber: '100-100001405WOF',
      mountNote: 'Confirmar BIOS Ryzen 9000 de la placa y cooler AM5. El perfil reserva 142 W como estimación conservadora de planificación, no como consumo medido ni TDP de AMD. El TDP declarado es 65 W; PBO/cambios de potencia requieren otra revisión.' },
  },
  {
    id: 'gpu-asrock-9060xt-16', category: 'gpu', name: 'ASRock RX 9060 XT Challenger 16GB OC',
    description: 'AMD · 16 GB GDDR6 · 249 mm · 1 × 8-pin · PSU fabricante: 550 W',
    price: 399990, icon: 'gpu',
    image: 'https://www.asrock.com/Graphics-Card/photo/Radeon%20RX%209060%20XT%20Challenger%2016GB%20OC%28M1%29.png',
    imageSource: 'https://www.asrock.com/Graphics-Card/AMD/Radeon%20RX%209060%20XT%20Challenger%2016GB%20OC/index.us.asp',
    imageLabel: 'Foto del modelo · ASRock',
    specs: { brand: 'AMD', integrated: false, power: 200, lengthMm: 249, pcie8: 1, twelveV: 0, minPsu: 550,
      vramGb: 16, partNumber: 'RX9060XT CL 16GO',
      mountNote: 'Dimensiones ASRock: 249 × 132 × 41 mm; confirmar espacio y ventilación. El perfil reserva 200 W como estimación conservadora, no como TBP certificado de esta versión OC. AMD declara 160 W típicos para la referencia; prevalece el mínimo de fuente ASRock de 550 W.' },
  },
];
