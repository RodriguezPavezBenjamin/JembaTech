import { describe, expect, it } from 'vitest';
import { Producto } from '../../modelos/catalogo';
import { PRESETS, draftFromPreset, presetPrice } from './presets';

describe('Presets con módulos individuales', () => {
  it('usa dos módulos sin reetiquetar un kit como una unidad', () => {
    for (const preset of PRESETS) {
      expect(preset.memory).toMatch(/^ram-module-DDR[45]-(8|16)$/);
      expect(draftFromPreset(preset).memory?.[0].quantity).toBe(2);
    }
  });
  it('elige un módulo observado equivalente y calcula el mismo total al mostrar y abrir', () => {
    const preset = PRESETS[2];
    const product = (id: string): Producto => ({ id, category: 'cpu', name: id, price: 100, description: '', icon: 'cpu', specs: {} });
    const products = [preset.cpu, preset.gpu, preset.board, preset.drive, 'cooler-stock', preset.case, preset.psu].map(product);
    products.push({ ...product(preset.memory), category: 'ram', specs: { ram: 'DDR5', capacityGb: 16, modules: 1, legacy: true } });
    products.push({ ...product('observed-module'), category: 'ram', price: 80000, specs: { ram: 'DDR5', capacityGb: 16, modules: 1 }, priceInfo: { kind: 'observed', source: 'SoloTodo', currency: 'CLP', externalId: '1', partNumber: null, storeHost: 'tienda.cl', offerUrl: 'https://tienda.cl/1', sourceUrl: 'https://www.solotodo.cl/products/1', observedAt: new Date().toISOString(), offerUpdatedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString(), normalPriceClp: 80000, offerPriceClp: 79000, scope: 'first-page' } });
    expect(draftFromPreset(preset, preset.budget, products).memory).toEqual([{ id: 'observed-module', quantity: 2 }]);
    expect(presetPrice(preset, products)).toBe(160700);
  });
});
