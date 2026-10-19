import { personalizeCatalog } from './catalog.personalization';
import { CatalogService } from './catalog.service';
import { CatalogProduct } from './catalog.types';

function observed(modules = 1): CatalogProduct {
  const now = new Date().toISOString();
  return { id: 'ram-observed', category: 'ram', name: 'RAM real', description: '', price: 80000, icon: 'ram', image: 'https://media.solotodo.com/media/products/1.jpg',
    specs: { ram: 'DDR5', modules, capacityGb: 16, speed: 5600, power: modules * 4 },
    priceInfo: { kind: 'observed', source: 'SoloTodo', currency: 'CLP', externalId: '1', partNumber: null, storeHost: 'tienda.cl', offerUrl: 'https://tienda.cl/1', sourceUrl: 'https://www.solotodo.cl/products/1', observedAt: now, offerUpdatedAt: now, expiresAt: new Date(Date.now() + 60000).toISOString(), normalPriceClp: 80000, offerPriceClp: 79000, scope: 'first-page' } };
}
describe('Catálogo personalizable por unidades', () => {
  it('ofrece módulos 8/16/32 DDR4 y 8/16/32/64 DDR5 con foto y estimación', () => {
    const visible = personalizeCatalog([]).filter(p => !p.specs.legacy);
    expect(visible.filter(p => p.specs.ram === 'DDR4').map(p => p.specs.capacityGb)).toEqual([8, 16, 32]);
    expect(visible.filter(p => p.specs.ram === 'DDR5').map(p => p.specs.capacityGb)).toEqual([8, 16, 32, 64]);
    for (const p of visible) {
      expect(p.specs.modules).toBe(1); expect(p.priceInfo?.kind).toBe('estimated');
      expect(p.price).toBeGreaterThan(0); expect(p.image).toMatch(/^https:/); expect(p.specs.partNumber).toBeUndefined();
    }
    expect(visible.find(p => p.specs.capacityGb === 64)?.specs.unverified).toContain('soporte BIOS para módulos individuales de 64 GB');
  });
  it('prefiere el módulo observado sin borrar el ID del perfil de respaldo', () => {
    const raw = observed(), copy = structuredClone(raw);
    const rows = personalizeCatalog([raw]);
    expect(rows.find(p => p.id === raw.id)).toEqual(raw);
    expect(rows.find(p => p.id === 'ram-module-DDR5-16')?.specs.legacy).toBe(true);
    expect(rows.find(p => p.id === 'ram-module-DDR5-8')).toMatchObject({ price: 40000, priceInfo: { kind: 'estimated' }, specs: { modules: 1, estimateReferenceIds: [raw.id] } });
    expect(raw).toEqual(copy);
  });
  it('no divide ni usa ofertas de kits como precio de un módulo', () => {
    const kit = observed(2), rows = personalizeCatalog([kit]);
    expect(rows.find(p => p.id === kit.id)).toMatchObject({ price: 80000, specs: { modules: 2, capacityGb: 16, legacy: true } });
    expect(rows.find(p => p.id === 'ram-module-DDR5-8')?.specs.estimateReferenceIds).toEqual([]);
  });
  it('un precio vencido o no disponible no sirve de ancla', () => {
    const expired = observed();
    if (expired.priceInfo?.kind === 'observed') expired.priceInfo.expiresAt = new Date(Date.now() - 1).toISOString();
    const rows = personalizeCatalog([expired]);
    expect(rows.find(p => p.id === 'ram-module-DDR5-16')?.specs.legacy).toBeUndefined();
    expect(rows.find(p => p.id === 'ram-module-DDR5-8')?.specs.estimateReferenceIds).toEqual([]);
  });
  it('conserva todos los perfiles PSU, sus precios y sus potencias, con fotos referenciales', () => {
    const rows = new CatalogService().list().products.filter(p => p.category === 'psu');
    expect(rows).toHaveLength(57);
    expect([...new Set(rows.map(p => p.specs.watts))]).toEqual([450, 550, 650, 750, 850, 1000, 1200]);
    for (const p of rows) { expect(p.image).toMatch(/^https:\/\/assets.corsair.com\//); expect(p.imageLabel).toContain('referencial'); expect(p.priceInfo?.kind).toBe('estimated'); }
    expect(new Set(rows.map(p => p.specs.form))).toEqual(new Set(['ATX', 'SFX', 'SFX-L']));
    expect(new Set(rows.map(p => p.specs.modularity))).toEqual(new Set(['No modular', 'Semimodular', 'Modular completa']));
    expect(rows.find(p => p.id === 'psu-650-Modular-completa-ATX')?.price).toBe(90000);
  });
});
