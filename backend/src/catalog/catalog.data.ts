import { CatalogProduct, ProductCategory } from "./catalog.types";
import { MODEL_PRODUCTS } from "./catalog.models";
import { PRODUCT_DETAILS } from "./catalog.photos";
import { HARDWARE_PRODUCTS } from "./catalog.hardware";
import { RECENT_PRODUCTS } from './catalog.recent';
import { EXPANDED_PRODUCTS } from './catalog.expansion';

// Precios manuales ilustrativos en CLP: no representan stock ni ofertas vigentes.
// Los perfiles genéricos declaran sus límites para probar las reglas del cotizador.
const product = (
  id: string,
  category: ProductCategory,
  name: string,
  description: string,
  price: number,
  specs: CatalogProduct["specs"],
  icon: string = category,
): CatalogProduct => ({
  id,
  category,
  name,
  description,
  price,
  icon,
  ...PRODUCT_DETAILS[id],
  specs: { ...specs, ...PRODUCT_DETAILS[id]?.specs },
});

export const PRODUCTS: CatalogProduct[] = [
  ...RECENT_PRODUCTS,
  ...EXPANDED_PRODUCTS,
  ...MODEL_PRODUCTS,
  ...HARDWARE_PRODUCTS,
  product(
    "cpu-5600g",
    "cpu",
    "AMD Ryzen 5 5600G",
    "AM4 · gráficos integrados · cooler incluido",
    129990,
    {
      brand: "AMD",
      socket: "AM4",
      ramTypes: ["DDR4"],
      power: 88,
      integrated: true,
      stockCooler: true,
    },
  ),
  product(
    "cpu-5600",
    "cpu",
    "AMD Ryzen 5 5600",
    "AM4 · requiere gráfica dedicada · cooler incluido",
    119990,
    {
      brand: "AMD",
      socket: "AM4",
      ramTypes: ["DDR4"],
      power: 88,
      integrated: false,
      stockCooler: true,
    },
  ),
  product(
    "cpu-7600",
    "cpu",
    "AMD Ryzen 5 7600",
    "AM5 · gráficos integrados · cooler incluido",
    209990,
    {
      brand: "AMD",
      socket: "AM5",
      ramTypes: ["DDR5"],
      power: 88,
      integrated: true,
      stockCooler: true,
    },
  ),
  product(
    "cpu-7800x3d",
    "cpu",
    "AMD Ryzen 7 7800X3D",
    "AM5 · cooler por separado",
    399990,
    {
      brand: "AMD",
      socket: "AM5",
      ramTypes: ["DDR5"],
      power: 162,
      integrated: true,
      stockCooler: false,
    },
  ),
  product(
    "cpu-i3",
    "cpu",
    "Intel Core i3-14100",
    "LGA1700 · DDR4 o DDR5 según placa",
    139990,
    {
      brand: "Intel",
      socket: "LGA1700",
      ramTypes: ["DDR4", "DDR5"],
      power: 110,
      integrated: true,
      stockCooler: true,
    },
  ),
  product(
    "cpu-i5",
    "cpu",
    "Intel Core i5-14400",
    "LGA1700 · gráficos integrados",
    249990,
    {
      brand: "Intel",
      socket: "LGA1700",
      ramTypes: ["DDR4", "DDR5"],
      power: 148,
      integrated: true,
      stockCooler: true,
    },
  ),
  product(
    "cpu-i5f",
    "cpu",
    "Intel Core i5-14400F",
    "LGA1700 · requiere gráfica dedicada",
    219990,
    {
      brand: "Intel",
      socket: "LGA1700",
      ramTypes: ["DDR4", "DDR5"],
      power: 148,
      integrated: false,
      stockCooler: true,
    },
  ),
  product(
    "cpu-i7",
    "cpu",
    "Intel Core i7-14700K",
    "LGA1700 · cooler por separado",
    459990,
    {
      brand: "Intel",
      socket: "LGA1700",
      ramTypes: ["DDR4", "DDR5"],
      power: 253,
      integrated: true,
      stockCooler: false,
    },
  ),
  product(
    "gpu-integrated",
    "gpu",
    "Gráficos integrados",
    "Sin tarjeta dedicada; depende del procesador",
    0,
    {
      brand: "Integrada",
      integrated: true,
      power: 0,
      lengthMm: 0,
      pcie8: 0,
      twelveV: 0,
    },
  ),
  product(
    "gpu-4060",
    "gpu",
    "GeForce RTX 4060 · perfil de referencia",
    "8 GB · dimensiones conservadoras para este perfil",
    369990,
    {
      brand: "NVIDIA",
      integrated: false,
      power: 115,
      lengthMm: 300,
      pcie8: 1,
      twelveV: 0,
    },
  ),
  product(
    "gpu-7600",
    "gpu",
    "Radeon RX 7600 · perfil de referencia",
    "8 GB · confirmar ensamblador y dimensiones finales",
    329990,
    {
      brand: "AMD",
      integrated: false,
      power: 165,
      lengthMm: 300,
      pcie8: 1,
      twelveV: 0,
    },
  ),
  product(
    "gpu-7800xt",
    "gpu",
    "Radeon RX 7800 XT · perfil de referencia",
    "16 GB · confirmar ensamblador y dimensiones finales",
    599990,
    {
      brand: "AMD",
      integrated: false,
      power: 263,
      lengthMm: 340,
      pcie8: 2,
      twelveV: 0,
    },
  ),
  product(
    "gpu-4070s",
    "gpu",
    "GeForce RTX 4070 SUPER · perfil de referencia",
    "12 GB · perfil con conector 12V-2x6/12VHPWR",
    649990,
    {
      brand: "NVIDIA",
      integrated: false,
      power: 220,
      lengthMm: 330,
      pcie8: 0,
      twelveV: 1,
    },
  ),
];

for (const socket of ["AM4", "AM5", "LGA1700"]) {
  const ramTypes =
    socket === "AM4"
      ? ["DDR4"]
      : socket === "AM5"
        ? ["DDR5"]
        : ["DDR4", "DDR5"];
  for (const ram of ramTypes) {
    for (const form of ["Mini-ITX", "Micro-ATX", "ATX", "E-ATX"]) {
      const compact = form === "Mini-ITX";
      PRODUCTS.push(
        product(
          `board-${socket}-${ram}-${form}`,
          "board",
          `${socket} ${ram} · ${form}`,
          "Perfil de placa de referencia · BIOS del modelo final por verificar",
          (ram === "DDR5" ? 149990 : 109990) +
            (compact ? 40000 : form === "E-ATX" ? 100000 : 0),
          {
            socket,
            ram,
            form,
            wifi: compact,
            maxRam: compact ? 96 : 128,
            ramSlots: compact ? 2 : 4,
            m2: compact ? 1 : 2,
            sata: compact ? 2 : form === "ATX" ? 6 : form === "E-ATX" ? 8 : 4,
            cpuEps: 1,
            legacy: true,
          },
        ),
      );
    }
  }
}

for (const ram of ["DDR4", "DDR5"]) {
  for (const capacityGb of [8, 16, 32, 64, 128]) {
    PRODUCTS.push(
      product(
        `ram-${ram}-${capacityGb}`,
        "ram",
        `${ram} · ${capacityGb} GB`,
        `${capacityGb === 8 ? "1 módulo" : capacityGb === 128 ? "4 módulos" : "Kit de 2 módulos"} · perfil JEDEC de referencia`,
        Math.round((capacityGb * (ram === "DDR5" ? 2900 : 2200)) / 1000) *
          1000 -
          10,
        {
          ram,
          capacityGb,
          modules: capacityGb === 8 ? 1 : capacityGb === 128 ? 4 : 2,
          power: capacityGb === 128 ? 16 : capacityGb === 8 ? 4 : 8,
          legacy: true,
        },
      ),
    );
  }
}

for (const kind of ["HDD", "SATA", "NVMe"]) {
  const capacities =
    kind === "HDD" ? [1000, 2000, 4000, 8000] : [250, 500, 1000, 2000, 4000];
  for (const capacityGb of capacities) {
    for (const generation of kind === "NVMe" ? [3, 4, 5] : [0]) {
      const capacity =
        capacityGb >= 1000 ? `${capacityGb / 1000} TB` : `${capacityGb} GB`;
      PRODUCTS.push(
        product(
          `storage-${kind}-${capacityGb}-${generation}`,
          "storage",
          `${kind === "HDD" ? "HDD" : "SSD " + kind} ${capacity}${generation ? " · Gen " + generation : ""}`,
          kind === "HDD"
            ? "3,5 pulgadas · SATA · archivos y almacenamiento secundario"
            : kind === "SATA"
              ? "2,5 pulgadas · SATA · sistema y aplicaciones"
              : "M.2 2280 · PCIe · velocidad final limitada por la placa",
          Math.round(
            (capacityGb * (kind === "HDD" ? 17 : kind === "SATA" ? 35 : 42) +
              22000 +
              generation * 3000) /
              1000,
          ) *
            1000 -
            10,
          {
            kind,
            capacityGb,
            generation,
            power: kind === "HDD" ? 10 : kind === "SATA" ? 5 : 10,
            legacy: true,
          },
          kind.toLowerCase(),
        ),
      );
    }
  }
}

PRODUCTS.push(
  product(
    "cooler-stock",
    "cooler",
    "Cooler incluido con el procesador",
    "Disponible solo si la presentación elegida lo incluye",
    0,
    {
      kind: "stock",
      heightMm: 70,
      radiatorMm: 0,
      power: 3,
      sockets: ["AM4", "AM5", "LGA1200", "LGA1700", "LGA1851"],
    },
  ),
  product(
    "cooler-tower",
    "cooler",
    "Torre por aire · 155 mm",
    "Perfil de referencia · un ventilador incluido",
    39990,
    {
      kind: "air",
      legacy: true,
      heightMm: 155,
      radiatorMm: 0,
      power: 4,
      sockets: ["AM4", "AM5", "LGA1700"],
    },
  ),
  product(
    "cooler-dual",
    "cooler",
    "Doble torre · 165 mm",
    "Perfil de referencia · dos ventiladores incluidos",
    69990,
    {
      kind: "air",
      legacy: true,
      heightMm: 165,
      radiatorMm: 0,
      power: 8,
      sockets: ["AM4", "AM5", "LGA1700"],
    },
  ),
  product(
    "support-gpu",
    "support",
    "Soporte anticaída de gráfica",
    "Opcional · confirmar altura y espacio del montaje final",
    12990,
    { power: 0, legacy: true },
  ),
);
for (const radiatorMm of [120, 240, 280, 360, 420]) {
  PRODUCTS.push(
    product(
      `cooler-aio-${radiatorMm}`,
      "cooler",
      `Refrigeración líquida AIO · ${radiatorMm} mm`,
      "Bomba y ventiladores del radiador incluidos · perfil de referencia",
      49990 + radiatorMm * 150,
      {
        kind: "aio",
        legacy: true,
        heightMm: 60,
        radiatorMm,
        power: 25,
        sockets: ["AM4", "AM5", "LGA1700"],
      },
      "aio",
    ),
  );
}
for (const sizeMm of [120, 140]) {
  for (const rgb of [false, true]) {
    PRODUCTS.push(
      product(
        `fan-${sizeMm}-${rgb ? "rgb" : "plain"}`,
        "fan",
        `Ventilador ${sizeMm} mm${rgb ? " · ARGB" : " · sin iluminación"}`,
        "Unidad adicional para gabinete · perfil de referencia",
        rgb ? 9990 : 6990,
        { sizeMm, rgb, power: rgb ? 6 : 3, legacy: true },
      ),
    );
  }
}

const cases = [
  {
    id: "itx",
    form: "Mini-ITX",
    forms: ["Mini-ITX"],
    gpu: 300,
    height: 150,
    radiators: [120, 240],
    fan120: 4,
    fan140: 0,
    included120: 1,
    included140: 0,
    bays25: 2,
    bays35: 0,
    psu: ["SFX", "SFX-L"],
    price: 89990,
  },
  {
    id: "matx",
    form: "Micro-ATX",
    forms: ["Mini-ITX", "Micro-ATX"],
    gpu: 320,
    height: 160,
    radiators: [120, 240],
    fan120: 6,
    fan140: 2,
    included120: 2,
    included140: 0,
    bays25: 2,
    bays35: 2,
    psu: ["ATX"],
    price: 59990,
  },
  {
    id: "atx",
    form: "ATX",
    forms: ["Mini-ITX", "Micro-ATX", "ATX"],
    gpu: 370,
    height: 170,
    radiators: [120, 240, 280, 360],
    fan120: 8,
    fan140: 4,
    included120: 3,
    included140: 0,
    bays25: 3,
    bays35: 2,
    psu: ["ATX"],
    price: 79990,
  },
  {
    id: "eatx",
    form: "E-ATX",
    forms: ["Mini-ITX", "Micro-ATX", "ATX", "E-ATX"],
    gpu: 400,
    height: 190,
    radiators: [120, 240, 280, 360, 420],
    fan120: 10,
    fan140: 6,
    included120: 0,
    included140: 3,
    bays25: 4,
    bays35: 4,
    psu: ["ATX"],
    price: 129990,
  },
];
for (const item of cases) {
  PRODUCTS.push(
    product(
      `case-${item.id}`,
      "case",
      `Gabinete ${item.form} · referencia`,
      "Perfil de montaje ilustrativo · confirmar modelo y distribución antes de comprar",
      item.price,
      {
        forms: item.forms,
        gpuClearanceMm: item.gpu,
        coolerClearanceMm: item.height,
        radiators: item.radiators,
        fan120: item.fan120,
        fan140: item.fan140,
        included120: item.included120,
        included140: item.included140,
        bays25: item.bays25,
        bays35: item.bays35,
        psuForms: item.psu,
        legacy: true,
      },
    ),
  );
}
for (const watts of [450, 550, 650, 750, 850, 1000, 1200]) {
  for (const modularity of ["No modular", "Semimodular", "Modular completa"]) {
    for (const form of watts <= 1000 ? ["ATX", "SFX", "SFX-L"] : ["ATX"]) {
      PRODUCTS.push(
        product(
          `psu-${watts}-${modularity.replace(/ /g, "-")}-${form}`,
          "psu",
          `${watts} W · ${modularity} · ${form}`,
          "Perfil de fuente de referencia · conectores y certificación por confirmar en modelo final",
          watts * 100 +
            (modularity === "Modular completa"
              ? 25000
              : modularity === "Semimodular"
                ? 10000
                : 0) +
            (form !== "ATX" ? 30000 : 0),
          {
            watts,
            modularity,
            form,
            pcie8: watts >= 650 ? 3 : 1,
            twelveV: watts >= 750 ? 1 : 0,
            sataPower: watts >= 650 ? 8 : 4,
            cpuEps: watts >= 650 ? 2 : 1,
          },
        ),
      );
    }
  }
}
