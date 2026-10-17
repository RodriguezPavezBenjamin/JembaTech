import { BadRequestException } from "@nestjs/common";
import { CatalogService } from "./catalog.service";

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
    expect(boards).toHaveLength(6);
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
