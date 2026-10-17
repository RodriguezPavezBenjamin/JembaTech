import { CatalogProduct } from "./catalog.types";

// Referencias visuales: enlazadas a sus editores, no redistribuidas como assets propios.
// Las fichas técnicas de GPU se verificaron en MSI y Sapphire (2026-10-16).
export const PRODUCT_DETAILS: Record<string, Partial<CatalogProduct>> = {
  "cpu-5600g": {
    image:
      "https://cdn.shopify.com/s/files/1/0316/0804/5705/files/5600G_1024x1024_7eecf15c-aed0-4980-affc-44ae44402d1d_600x600.jpg?v=1675958712",
    imageSource:
      "https://utopiacomputers.co.uk/blogs/utopia-blogs/a-beginners-guide-to-understanding-cpus-in-gaming-pcs",
    imageLabel: "Foto de referencia · Utopia Computers",
  },
  "cpu-5600": {
    image: "https://cdr.cz/sites/default/files/r55600rogvi-2.jpg",
    imageSource:
      "https://diit.cz/clanek/recenze-amd-ryzen-5-5600-sestijadro-bez-x-stejnym-vykonem",
    imageLabel: "Foto de referencia · Diit.cz",
  },
  "cpu-7600": {
    image:
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3d/AMD_Ryzen_5_7600_top_IMGP6773_smial_wp.jpg/500px-AMD_Ryzen_5_7600_top_IMGP6773_smial_wp.jpg",
    imageSource:
      "https://commons.wikimedia.org/wiki/File:AMD_Ryzen_5_7600_top_IMGP6773_smial_wp.jpg",
    imageLabel: "Foto: Rainer Knäpper · Free Art License",
    imageLicense: "https://artlibre.org/licence/lal/en/",
  },
  "cpu-7800x3d": {
    image:
      "https://image.itmedia.co.jp/pcuser/articles/2304/05/l_si7101-X3D-01.jpg",
    imageSource:
      "https://www.itmedia.co.jp/pcuser/articles/2304/05/news181.html",
    imageLabel: "Foto de referencia · ITmedia",
  },
  "cpu-i3": {
    image:
      "https://pcbox.vtexassets.com/arquivos/ids/2866974/BX8071514100_GAL_1.jpg?v=638756625818300000",
    imageSource:
      "https://www.pcbox.com/bx8071514100-core-i3-14100-3-50ghz-sktlga1700-12-00mb-cache-box-ed/p",
    imageLabel: "Presentación de referencia · PCBox",
  },
  "cpu-i5": {
    image:
      "https://assets.umart.com.au/newsite/images/202401/source_img/Intel-CPU-Intel-Core-i5-14400-10-Core-4-70GHz-LGA-1700-CPU-Processor-1.jpg",
    imageSource:
      "https://www.umart.com.au/product/intel-core-i5-14400-10-core-4-70ghz-lga-1700-boxed-cpu-processor-bx8071514400-75274",
    imageLabel: "Presentación de referencia · Umart",
  },
  "cpu-i5f": {
    image: "https://needy.shop/cdn/shop/files/14400F_700x700.jpg?v=1710847407",
    imageSource: "https://needy.shop/products/intel-cpu-core-i5-14400f-tray",
    imageLabel: "Caja de referencia · Needy Shop · presentación puede variar",
  },
  "cpu-i7": {
    image:
      "https://sigmatiendas.com/cdn/shop/files/Procesador-Intel-Core-i7-14700K-20-Nucleos-3_4GHz-30MB-cache-Socket-LGA1700_1_grande.jpg?v=1738682164",
    imageSource:
      "https://sigmatiendas.com/products/procesador-intel-core-i7-14700k-20-nucleos-3-4-ghz-30-mb-cache-socket-lga-1700",
    imageLabel: "Presentación de referencia · Sigma",
  },
  "gpu-4060": {
    name: "MSI GeForce RTX 4060 Ventus 2X Black 8G OC",
    description: "NVIDIA · 8 GB · 199 mm · 8-pin · PSU de fabricante: 550 W",
    image:
      "https://storage-asset.msi.com/global/picture/image/feature/vga/NVIDIA/RTX-4060-VENTUS-2X-BLACK-8G/images/msi-rtx4060-ventus-2x-black-8g-kv.png",
    imageSource:
      "https://www.msi.com/Graphics-Card/GeForce-RTX-4060-VENTUS-2X-BLACK-8G-OC/Specification",
    imageLabel: "Foto de familia Ventus · MSI",
    specs: { lengthMm: 199, power: 120, minPsu: 550 },
  },
  "gpu-4070s": {
    name: "MSI GeForce RTX 4070 SUPER Ventus 2X OC · 12 GB",
    description: "NVIDIA · 242 mm · 16-pin · PSU de fabricante: 650 W",
    image:
      "https://storage-asset.msi.com/global/picture/image/feature/vga/NVIDIA/RTX-4070-VENTUS/2X-E-12G-OC/images/msi-rtx4070-ventus-2x-e-12g-kv-pc.png",
    imageSource:
      "https://www.msi.com/Graphics-Card/GeForce-RTX-4070-SUPER-12G-VENTUS-2X-OC/Specification",
    imageLabel: "Foto de familia Ventus · MSI",
    specs: { lengthMm: 242, power: 220, minPsu: 650 },
  },
  "gpu-7600": {
    name: "Sapphire PULSE Radeon RX 7600 · 8 GB",
    description: "AMD · 240 mm · 8-pin · PSU de fabricante: 550 W",
    image:
      "https://media.cdn.sapphiretech.com.cn/-/media/sites/sapphire/pim/product-images/11324_01_rx7600_pulse_8ggddr6/11324_01_rx7600_pulse_8gbgddr6_c01_800x500.ashx?v=31857520491e4c678d9292bbd095cfc7",
    imageSource:
      "https://www.sapphiretech.com/en/consumer/pulse-radeon-rx-7600-8g-gddr6",
    imageLabel: "Foto del producto · Sapphire",
    specs: { lengthMm: 240, power: 185, minPsu: 550 },
  },
  "gpu-7800xt": {
    name: "Sapphire PULSE Radeon RX 7800 XT · 16 GB",
    description: "AMD · 280 mm · 2 × 8-pin · PSU de fabricante: 700 W",
    image:
      "https://media.cdn.sapphiretech.com.cn/-/media/sites/sapphire/pim/product-images/11330_02_7800xt_pulse_16gddr6_dual-fan/11330_02_rx7800xt_pulse_16ggddr6_c01_800x500.ashx?v=6886c553c7854b42ad26a8628006aa57",
    imageSource:
      "https://www.sapphiretech.com/en/consumer/pulse-radeon-rx-7800-xt-16g-gddr6",
    imageLabel: "Foto del producto · Sapphire",
    specs: { lengthMm: 280, power: 266, minPsu: 700 },
  },
};
