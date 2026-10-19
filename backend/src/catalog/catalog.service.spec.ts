import { BadRequestException } from "@nestjs/common";
import { CatalogService } from "./catalog.service";
import { EXPANDED_PRODUCTS } from './catalog.expansion';

describe("CatalogService", () => {
  const service = new CatalogService();
  const base = {
    budget: 1000000,
    intendedUse: "gaming",
    drives: [],
    extras: [],
  };

  it("resuelve precios desde el servidor e identifica las fichas de referencia", () => {
    const result = service.resolve({ ...base, cpu: "cpu-7600" });
    expect(result.components[0]).toMatchObject({
      id: "cpu-7600",
      price: 209990,
      quantity: 1,
    });
    expect(service.list().source).toBe("reference-manual");
  });
  it('agrega modelos recientes sin reemplazar IDs y distingue el presupuesto eléctrico del TDP', () => {
    const products = service.list().products;
    expect(products.find(p => p.id === 'cpu-9600x')?.specs).toMatchObject({ socket: 'AM5', stockCooler: false, integrated: true, declaredTdpWatts: 65, power: 142 });
    expect(products.find(p => p.id === 'gpu-asrock-9060xt-16')?.specs).toMatchObject({ vramGb: 16, lengthMm: 249, minPsu: 550, pcie8: 1 });
    expect(service.resolve({ ...base, cpu: 'cpu-9600x', gpu: 'gpu-asrock-9060xt-16' }).components).toHaveLength(2);
  });

  it("rechaza un producto que pertenece a una categoría distinta", () => {
    expect(() => service.resolve({ ...base, cpu: "gpu-4060" })).toThrow(
      BadRequestException,
    );
  });

  it("publica placas concretas con fotos y ranuras verificables sin quitar IDs antiguos", () => {
    const products = service.list().products;
    const boards = products.filter(
      (p) => p.category === "board" && !p.specs.legacy,
    );
    expect(boards).toHaveLength(8);
    expect(
      boards.every(
        (p) =>
          p.image?.startsWith("https:") &&
          p.imageSource?.includes("Specification"),
      ),
    ).toBe(true);
    expect(
      boards.find((p) => p.id === "board-msi-b650i-edge")?.specs,
    ).toMatchObject({
      form: "Mini-ITX",
      ramSlots: 2,
      maxRam: 128,
      m2: 2,
      sata: 4,
    });
    expect(
      products.find((p) => p.id === "board-AM4-DDR4-ATX")?.specs.legacy,
    ).toBe(true);
    expect(
      service.resolve({ ...base, board: "board-AM4-DDR4-ATX" }).components[0]
        .id,
    ).toBe("board-AM4-DDR4-ATX");
  });

  it('amplía cinco categorías sin duplicar IDs ni presentar estimaciones como ofertas', () => {
    const products = service.list().products;
    expect(new Set(products.map(p => p.id)).size).toBe(products.length);
    expect(EXPANDED_PRODUCTS).toHaveLength(22);
    for (const [category, count] of Object.entries({ cpu: 8, gpu: 4, board: 2, ram: 4, storage: 4 })) {
      expect(EXPANDED_PRODUCTS.filter(p => p.category === category)).toHaveLength(count);
    }
    for (const added of EXPANDED_PRODUCTS) {
      const published = products.find(p => p.id === added.id)!;
      expect(published.specs.legacy).toBe(added.category === 'ram' && added.specs.modules !== 1 ? true : undefined);
      expect(published.priceInfo).toEqual({ kind: 'estimated' });
      expect(published.price).toBeGreaterThan(0);
      expect(published.imageSource).toMatch(/^https:/);
    }
    expect(products.find(p => p.id === 'cpu-7500f')?.specs).toMatchObject({ integrated: false, stockCooler: true, socket: 'AM5' });
    expect(products.find(p => p.id === 'cpu-i5-12400f')?.specs).toMatchObject({ integrated: false, stockCooler: false });
    expect(products.find(p => p.id === 'drive-kingston-nv3-1000')?.specs).toMatchObject({ kind: 'NVMe', partNumber: 'SNV3S/1000G' });
    expect(products.find(p => p.id === 'drive-crucial-mx500-2000')?.specs).toMatchObject({ kind: 'SATA', partNumber: 'CT2000MX500SSD1' });
  });

  it('resuelve kits nuevos por producto y transmite el uso sin recortar el catálogo', () => {
    const draft = { ...base, cpu: 'cpu-9700x', board: 'board-msi-b650-gaming-plus',
      memory: [{ id: 'ram-fury-ddr5-kit-32', quantity: 2 }], drives: [{ id: 'drive-kingston-nv3-1000', quantity: 1 }] };
    const gaming = service.resolve(draft);
    const office = service.resolve({ ...draft, intendedUse: 'oficina' });
    expect(gaming.components).toEqual(office.components);
    expect(office.intended_use).toBe('oficina');
    expect(gaming.components.find(p => p.category === 'ram')).toMatchObject({ quantity: 2, specs: { modules: 2, capacityGb: 32 } });
  });

  it("incluye fotos de aire, AIO, gabinete y accesorios con montaje declarado", () => {
    const products = service.list().products;
    for (const id of [
      "cooler-deepcool-ak400",
      "cooler-deepcool-le520",
      "case-corsair-4000d",
      "fan-deepcool-rf120",
      "support-deepcool-gh01",
    ]) {
      const product = products.find((p) => p.id === id)!;
      expect(product.image).toMatch(/^https:/);
      expect(product.specs.mountNote).toBeTruthy();
    }
    expect(
      products.find((p) => p.id === "case-fractal-meshify2")?.specs,
    ).toMatchObject({ gpuClearanceMm: 315, bays35: 6, boardMaxWidthMm: 285 });
  });

  it("conserva cantidades y rechaza unidades duplicadas", () => {
    const drive = { id: "storage-NVMe-1000-4", quantity: 2 };
    expect(
      service.resolve({ ...base, drives: [drive] }).components[0].quantity,
    ).toBe(2);
    expect(() => service.resolve({ ...base, drives: [drive, drive] })).toThrow(
      BadRequestException,
    );
  });

  it("rechaza extras fuera de la categoría permitida y múltiples soportes", () => {
    expect(() =>
      service.resolve({ ...base, extras: [{ id: "cpu-7600", quantity: 1 }] }),
    ).toThrow();
    expect(() =>
      service.resolve({
        ...base,
        extras: [{ id: "support-gpu", quantity: 2 }],
      }),
    ).toThrow();
  });

  it("resuelve RAM por módulos, con precios y fotos desde el catálogo", () => {
    const result = service.resolve({
      ...base,
      memory: [{ id: "ram-kingston-ddr4-8", quantity: 2 }],
    });
    expect(result.components[0]).toMatchObject({
      category: "ram",
      quantity: 2,
      specs: { capacityGb: 8, modules: 1 },
    });
    expect(result.components[0].image).toMatch(/^https:/);
    expect(() =>
      service.resolve({
        ...base,
        ram: "ram-DDR4-8",
        memory: [{ id: "ram-kingston-ddr4-8", quantity: 1 }],
      }),
    ).toThrow();
  });
});
