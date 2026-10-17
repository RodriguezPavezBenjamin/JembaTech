import assert from "node:assert/strict";
import { before, test } from "node:test";

const origin = process.env.TEST_API_URL ?? "http://127.0.0.1:3000/api";
const draft = {
  budget: 1000000,
  intendedUse: "gaming",
  cpu: "cpu-7600",
  gpu: "gpu-integrated",
  board: "board-AM5-DDR5-ATX",
  ram: "ram-DDR5-32",
  drives: [
    { id: "storage-NVMe-1000-4", quantity: 1 },
    { id: "storage-HDD-2000-0", quantity: 2 },
  ],
  cooler: "cooler-stock",
  extras: [],
  case: "case-atx",
  psu: "psu-650-Modular-completa-ATX",
};

const post = (path, body) =>
  fetch(`${origin}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

before(async () => {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const response = await fetch(`${origin}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) return;
    } catch {
      /* Esperar arranque de migraciones y API en CI. */
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("La API no inició dentro del tiempo esperado.");
});

test("catálogo y PostgreSQL responden", async () => {
  assert.equal((await (await fetch(`${origin}/health`)).json()).database, "ok");
  const catalog = await (await fetch(`${origin}/catalog`)).json();
  assert.equal(catalog.source, "reference-manual");
  assert.ok(catalog.products.some((item) => item.id === draft.cpu));
});

test("NestJS consulta FastAPI: discos mixtos, precio y margen de fuente", async () => {
  const response = await post("/builds/preview", draft);
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.storage_gb, 5000);
  assert.equal(result.can_save, true);
  assert.ok(result.total_price > 0);
  assert.ok(result.total_price !== draft.budget);
  assert.equal(
    result.recommended_watts,
    Math.ceil((result.estimated_consumption_watts * 1.35) / 50) * 50,
  );
});

test("un cambio de placa conserva piezas y detecta incompatibilidad", async () => {
  const response = await post("/builds/preview", {
    ...draft,
    board: "board-AM4-DDR4-ATX",
  });
  const result = await response.json();
  assert.equal(result.can_save, false);
  assert.ok(result.issues.some((issue) => issue.category === "board"));
});

test("los modelos nuevos funcionan juntos y una placa ITX limita los módulos RAM", async () => {
  const hardware = {
    ...draft,
    ram: undefined,
    board: "board-msi-b650-s",
    memory: [{ id: "ram-kingston-ddr5-16", quantity: 2 }],
    cooler: "cooler-deepcool-le520",
    drives: [{ id: "drive-samsung-990-pro-1000", quantity: 1 }],
    case: "case-corsair-4000d",
    extras: [{ id: "support-deepcool-gh01", quantity: 1 }],
  };
  const response = await post("/builds/preview", hardware);
  assert.equal(response.status, 201);
  assert.equal((await response.json()).can_save, true);
  const incompatible = await post("/builds/preview", {
    ...hardware,
    board: "board-msi-b650i-edge",
    memory: [{ id: "ram-kingston-ddr5-16", quantity: 3 }],
  });
  const result = await incompatible.json();
  assert.equal(result.can_save, false);
  assert.ok(result.issues.some((issue) => issue.category === "ram"));
});

test("suma módulos RAM y combina dos HDD con tres SSD sin mezclar cantidades", async () => {
  const response = await post("/builds/preview", {
    ...draft,
    ram: undefined,
    name: "Prueba de cantidades",
    memory: [{ id: "ram-kingston-ddr5-16", quantity: 2 }],
    drives: [
      { id: "drive-seagate-barracuda-1000", quantity: 2 },
      { id: "drive-samsung-870-evo-1000", quantity: 3 },
    ],
  });
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.ram_gb, 32);
  assert.equal(result.storage_gb, 5000);
  assert.equal(result.can_save, true);
});

test("rechaza IDs falsos, cantidades inválidas y guardado sin sesión", async () => {
  assert.equal(
    (await post("/builds/preview", { ...draft, cpu: "cpu-inventado" })).status,
    400,
  );
  assert.equal(
    (
      await post("/builds/preview", {
        ...draft,
        drives: [{ id: draft.drives[0].id, quantity: -1 }],
      })
    ).status,
    400,
  );
  assert.equal((await post("/builds", draft)).status, 401);
});
