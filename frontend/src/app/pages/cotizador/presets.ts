import { Borrador, Producto } from "../../modelos/catalogo";

export interface Preset {
  id: string;
  name: string;
  description: string;
  tagline: string;
  image: string;
  imagePosition: string;
  use: string;
  budget: number;
  cpu: string;
  gpu: string;
  board: string;
  memory: string;
  quantity: number;
  drive: string;
  case: string;
  psu: string;
}
export const PRESETS: Preset[] = [
  {
    id: "diario",
    name: "Día a día",
    description: "Estudio y oficina · 16 GB · SSD 480 GB",
    tagline: "Estudia. Trabaja. Conecta.",
    image:
      "media/portfolio/SnapInsta.to_652312101_18112753729669966_5907132694303239556_n.jpg",
    imagePosition: "75% 60%",
    use: "oficina",
    budget: 500000,
    cpu: "cpu-5600g",
    gpu: "gpu-integrated",
    board: "board-msi-b550m-vdh",
    memory: "ram-kingston-ddr4-8",
    quantity: 2,
    drive: "drive-kingston-a400-480",
    case: "case-fractal-pop-mini",
    psu: "psu-450-No-modular-ATX",
  },
  {
    id: "gaming",
    name: "Gaming inicial",
    description: "Ryzen 5 + RTX 4060 · 16 GB · NVMe 1 TB",
    tagline: "Tu próxima partida empieza aquí.",
    image:
      "media/portfolio/SnapInsta.to_649393137_17978679602825836_1167495615100214261_n.jpg",
    imagePosition: "60% 42%",
    use: "gaming",
    budget: 1000000,
    cpu: "cpu-5600",
    gpu: "gpu-4060",
    board: "board-msi-b550-a-pro",
    memory: "ram-kingston-ddr4-rgb-16",
    quantity: 1,
    drive: "drive-samsung-990-pro-1000",
    case: "case-corsair-4000d",
    psu: "psu-650-Modular-completa-ATX",
  },
  {
    id: "creador",
    name: "Creador",
    description: "Ryzen 5 AM5 + RTX 4070 SUPER · 32 GB · NVMe 2 TB",
    tagline: "Dale espacio a tus ideas.",
    image:
      "media/portfolio/SnapInsta.to_652843846_18110027842753258_5339563256197555192_n.jpg",
    imagePosition: "50% 50%",
    use: "edicion",
    budget: 1500000,
    cpu: "cpu-7600",
    gpu: "gpu-4070s",
    board: "board-msi-b650-s",
    memory: "ram-corsair-vengeance-32",
    quantity: 1,
    drive: "drive-samsung-990-pro-2000",
    case: "case-corsair-4000d",
    psu: "psu-750-Modular-completa-ATX",
  },
];
export function draftFromPreset(
  preset: Preset,
  budget = preset.budget,
): Borrador {
  return {
    name: preset.name,
    budget,
    intendedUse: preset.use,
    cpu: preset.cpu,
    gpu: preset.gpu,
    board: preset.board,
    memory: [{ id: preset.memory, quantity: preset.quantity }],
    drives: [{ id: preset.drive, quantity: 1 }],
    extras: [],
    cooler: "cooler-stock",
    case: preset.case,
    psu: preset.psu,
  };
}
export function presetPrice(preset: Preset, products: Producto[]) {
  const draft = draftFromPreset(preset);
  const ids = [
    preset.cpu,
    preset.gpu,
    preset.board,
    preset.memory,
    preset.drive,
    "cooler-stock",
    preset.case,
    preset.psu,
  ];
  if (ids.some((id) => !products.some((product) => product.id === id)))
    return undefined;
  return ids.reduce(
    (sum, id) =>
      sum +
      products.find((product) => product.id === id)!.price *
        (id === draft.memory![0].id ? preset.quantity : 1),
    0,
  );
}
