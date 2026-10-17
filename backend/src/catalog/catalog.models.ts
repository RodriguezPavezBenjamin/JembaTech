import { CatalogProduct } from "./catalog.types";

// Modelos/familias contrastados con fichas oficiales. Precios CLP de referencia,
// no ofertas vigentes. Las fotos se enlazan al fabricante, sin asumir licencia libre.
const kingston = "https://www.kingston.com/en/";
const ramPhoto = (ddr: string, rgb = false) =>
  `https://media.kingston.com/kingston/product-comparison/ktc-comp-chart-fury-beast-${ddr.toLowerCase()}${rgb ? "-rgb" : ""}_tn.png`;
const corsairLpx =
  "https://www.corsair.com/us/en/p/memory/cmk8gx4m1e3200c16/vengeancea-lpx-8gb-1-x-8gb-ddr4-dram-3200mhz-c16-memory-kit-black-cmk8gx4m1e3200c16";
const corsairDdr5 =
  "https://www.corsair.com/us/en/p/memory/cmk32gx5m2b6000c30/vengeance-32gb-2x16gb-ddr5-dram-6000mt-s-cl30-memory-kit-black-cmk32gx5m2b6000c30";

export const MODEL_PRODUCTS: CatalogProduct[] = [];
function memory(
  id: string,
  brand: string,
  family: string,
  ram: string,
  capacityGb: number,
  modules: number,
  speed: number,
  rgb: boolean,
  price: number,
  image: string,
  source: string,
) {
  MODEL_PRODUCTS.push({
    id,
    category: "ram",
    name: `${brand} ${family} · ${capacityGb} GB (${modules} × ${capacityGb / modules})`,
    description: `${ram} · ${speed} MT/s · ${rgb ? "RGB" : "sin RGB"} · ${modules === 1 ? "por módulo" : "por kit"}`,
    price,
    icon: "ram",
    image,
    imageSource: source,
    imageLabel: "Foto de la familia · fabricante",
    specs: {
      brand,
      family,
      ram,
      capacityGb,
      modules,
      speed,
      rgb,
      power: modules * 4,
    },
  });
}
for (const capacity of [8, 16, 32]) {
  memory(
    `ram-kingston-ddr4-${capacity}`,
    "Kingston",
    "FURY Beast",
    "DDR4",
    capacity,
    1,
    3200,
    false,
    capacity * 2200,
    ramPhoto("DDR4"),
    kingston + "memory/gaming/kingston-fury-beast-ddr4-memory",
  );
}
for (const capacity of [16, 32]) {
  memory(
    `ram-kingston-ddr5-${capacity}`,
    "Kingston",
    "FURY Beast",
    "DDR5",
    capacity,
    1,
    5600,
    false,
    capacity * 2900,
    ramPhoto("DDR5"),
    kingston + "memory/gaming/kingston-fury-beast-ddr5-memory",
  );
  memory(
    `ram-kingston-ddr5-rgb-${capacity * 2}`,
    "Kingston",
    "FURY Beast RGB",
    "DDR5",
    capacity * 2,
    2,
    6000,
    true,
    capacity * 6200,
    ramPhoto("DDR5", true),
    kingston + "memory/gaming/kingston-fury-beast-ddr5-rgb-memory",
  );
}
memory(
  "ram-kingston-ddr4-rgb-16",
  "Kingston",
  "FURY Beast RGB",
  "DDR4",
  16,
  2,
  3200,
  true,
  42990,
  ramPhoto("DDR4", true),
  "https://www.kingston.com/datasheets/KF432C16BBAK2_16.pdf",
);
memory(
  "ram-corsair-lpx-8",
  "Corsair",
  "Vengeance LPX",
  "DDR4",
  8,
  1,
  3200,
  false,
  22990,
  "https://assets.corsair.com/image/upload/c_pad,q_85,h_360,w_360,f_auto/products/Memory/CMK8GX4M1E3200C16/Gallery/VENG_LPX_BLK_01.webp",
  corsairLpx,
);
memory(
  "ram-corsair-vengeance-32",
  "Corsair",
  "Vengeance",
  "DDR5",
  32,
  2,
  6000,
  false,
  104990,
  "https://assets.corsair.com/image/upload/c_pad,q_85,h_360,w_360,f_auto/products/Memory/vengeance-ddr5-blk-config/Gallery/VENGEANCE_DDR5_BLK_01_2up.webp",
  corsairDdr5,
);

function storage(
  brand: string,
  family: string,
  capacities: number[],
  kind: string,
  generation: number,
  image: string | undefined,
  source: string,
  power: number,
) {
  for (const capacityGb of capacities) {
    const label =
      capacityGb >= 1000 && capacityGb % 1000 === 0
        ? `${capacityGb / 1000} TB`
        : `${capacityGb} GB`;
    MODEL_PRODUCTS.push({
      id: `drive-${brand.toLowerCase()}-${family.toLowerCase().replace(/ /g, "-")}-${capacityGb}`,
      category: "storage",
      name: `${brand} ${family} · ${label}`,
      description: `${kind === "HDD" ? "HDD · 3,5 pulgadas · SATA" : kind === "SATA" ? "SSD SATA · 2,5 pulgadas" : `SSD NVMe · M.2 2280 · PCIe ${generation}.0`} · por unidad`,
      price:
        Math.round(
          (capacityGb * (kind === "HDD" ? 17 : kind === "SATA" ? 35 : 42) +
            22000 +
            generation * 3000) /
            1000,
        ) *
          1000 -
        10,
      icon: kind.toLowerCase(),
      image,
      imageSource: source,
      imageLabel: image ? "Foto de la familia · fabricante" : undefined,
      specs: { brand, family, capacityGb, kind, generation, power },
    });
  }
}
storage(
  "Seagate",
  "BarraCuda",
  [1000, 2000, 4000, 8000],
  "HDD",
  0,
  "https://i5.walmartimages.cl/asr/578f8719-1c00-40ec-a64c-afd99ffddd58.ac32342b91ff4f9eed4265823f6e8834.jpeg?odnBg=ffffff&odnHeight=400&odnWidth=400",
  "https://www.seagate.com/products/hard-drives/barracuda-hard-drive/",
  10,
);
for (const item of MODEL_PRODUCTS.filter(
  (p) => p.specs["brand"] === "Seagate",
)) {
  item.imageSource =
    "https://www.lider.cl/ip/almacenamiento/disco-duro-1-tb-interno-seagate-sata-3-7200rpm-3-5in-st10/00785881601958";
  item.imageLabel =
    "Foto BarraCuda 1 TB · Lider · otras capacidades pueden variar";
}
storage(
  "Kingston",
  "A400",
  [240, 480, 960],
  "SATA",
  0,
  "https://media.kingston.com/kingston/key-features/ktc-keyfeatures-ssd-a400-25-1-lg.jpg",
  kingston + "ssd/a400-solid-state-drive",
  2,
);
storage(
  "Kingston",
  "KC3000",
  [512, 1024, 2048, 4096],
  "NVMe",
  4,
  "https://media.kingston.com/kingston/key-features/ktc-keyfeatures-ssd-skc3000-4-lg.jpg",
  kingston + "ssd/kc3000-nvme-m2-solid-state-drive",
  11,
);
storage(
  "Samsung",
  "870 EVO",
  [250, 500, 1000, 2000, 4000],
  "SATA",
  0,
  "https://images.samsung.com/is/image/samsung/p6pim/us/mz-77e1t0b-am/gallery/us-sata-ssd-mz-77e1t0b-am-----evo---tb-ssd-sata-----inch-black-553784918?$PD_GALLERY_PNG$",
  "https://www.samsung.com/us/memory-storage/ssd/",
  5,
);
storage(
  "Samsung",
  "990 PRO",
  [1000, 2000, 4000],
  "NVMe",
  4,
  "https://images.samsung.com/is/image/samsung/p6pim/us/mz-v9p4t0b-am/gallery/us-nvme-ssd-mz-v9p4t0b-am-----pro---tb-ssd-nvme--m---black-551140993?$PD_GALLERY_PNG$",
  "https://www.samsung.com/us/memory-storage/ssd/",
  9,
);
