import { CatalogProduct } from './catalog.types';

const memoryPhoto = (ram: string) => `https://media.kingston.com/kingston/product-comparison/ktc-comp-chart-fury-beast-${ram.toLowerCase()}_tn.png`;
const corsairPhoto = (path: string) => `https://assets.corsair.com/image/upload/c_pad,q_auto,h_1024,w_1024,f_auto/products/Power-Supply-Units/${path}`;
const psuPhotos: Record<string, string> = {
  'No modular': corsairPhoto('base-cx-series-2023-config/CX650/CX650_01.webp'),
  Semimodular: corsairPhoto('CP-9020132-WW/Gallery/TX650M_01.webp'),
  'Modular completa': corsairPhoto('base-rmx-2024-config/gallery/black/1000/RM1000x_2024_01.webp'),
  SFX: corsairPhoto('sf-platinum-series/Gallery/1000/CP-9020257_01.webp'),
  'SFX-L': corsairPhoto('base-sfl-series-psu-config/CP-9020245/Gallery/CP-9020245_01.webp'),
};

// Vista personalizable: jamás dividir un kit comercial ni alterar sus IDs/precios.
// Los perfiles nuevos son estimaciones, no ofertas de un SKU inventado.
export function personalizeCatalog(products: CatalogProduct[]): CatalogProduct[] {
  const now = Date.now();
  const freshSingle = (p: CatalogProduct) => p.category === 'ram' && !p.specs.legacy && p.specs.modules === 1 && p.priceInfo?.kind === 'observed' && Date.parse(p.priceInfo.expiresAt) > now;
  const singles = products.filter(freshSingle);
  const result = products.map(p => {
    if (p.category === 'ram') {
      // Conservar kits y referencias antiguas para snapshots/borradores existentes.
      return freshSingle(p) ? p : { ...p, specs: { ...p.specs, legacy: true } };
    }
    if (p.category !== 'psu') return p;
    const form = String(p.specs.form), modularity = String(p.specs.modularity);
    return { ...p, image: psuPhotos[form === 'ATX' ? modularity : form], imageSource: 'https://www.corsair.com/us/en/c/psu',
      imageLabel: form === 'ATX' ? 'Foto referencial de cableado · CORSAIR · no es el modelo ofertado' : `Foto referencial ${form} · CORSAIR · potencia y cableado pueden variar`,
      specs: { ...p.specs, mountNote: 'Perfil estimado de planificación, no un SKU disponible. La foto ilustra el formato/cableado, no garantiza esa potencia, certificación ni conectores. Confirmar modelo final.', unverified: ['modelo de fuente, conectores y certificación'] } };
  });
  for (const ram of ['DDR4', 'DDR5']) {
    // DDR4 de escritorio: hasta 32 GB por UDIMM en este alcance, no RDIMM de servidor.
    for (const capacityGb of ram === 'DDR4' ? [8, 16, 32] : [8, 16, 32, 64]) {
      const covered = singles.some(p => p.specs.ram === ram && p.specs.capacityGb === capacityGb);
      const anchors = singles.filter(p => p.specs.ram === ram);
      const perGb = anchors.length ? Math.min(...anchors.map(p => p.price / Number(p.specs.capacityGb))) : ram === 'DDR4' ? 2200 : 2900;
      const basis = anchors.length ? 'Extrapolación orientativa por capacidad desde módulos individuales con precio normal consultado. No es una oferta para este perfil ni garantiza precio proporcional.' : 'Estimación manual de planificación en CLP; no es una oferta consultada ni stock disponible.';
      result.push({ id: `ram-module-${ram}-${capacityGb}`, category: 'ram', name: `${ram} · ${capacityGb} GB · módulo individual`,
        description: `1 × ${capacityGb} GB · DIMM de escritorio · ${ram === 'DDR4' ? 3200 : 5600} MT/s de referencia`,
        price: Math.round(perGb * capacityGb / 1000) * 1000, priceInfo: { kind: 'estimated' }, icon: 'ram', image: memoryPhoto(ram),
        imageSource: `https://www.kingston.com/en/memory/gaming/kingston-fury-beast-${ram.toLowerCase()}-memory`, imageLabel: 'Foto de familia referencial · Kingston · perfil sin SKU asignado',
        specs: { brand: 'Referencia', ram, formFactor: 'DIMM', capacityGb, modules: 1, speed: ram === 'DDR4' ? 3200 : 5600, power: 4, reference: true, ...(covered ? { legacy: true } : {}),
          estimateBasis: basis, estimateReferenceIds: anchors.map(p => p.id),
          unverified: ['modelo/SKU, latencias, velocidad final y QVL', ...(capacityGb === 64 ? ['soporte BIOS para módulos individuales de 64 GB'] : [])],
          mountNote: `${basis} La foto no identifica un SKU de esta capacidad. Confirmar velocidad, latencias y QVL. ${capacityGb === 64 ? '64 GB por módulo requiere soporte de placa/CPU/BIOS.' : ''}`.trim() } });
    }
  }
  return result;
}
