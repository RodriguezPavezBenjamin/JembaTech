export const SOURCE_CATEGORIES = ['cpu', 'gpu', 'motherboard', 'ram', 'storage'] as const;
export type SourceCategory = typeof SOURCE_CATEGORIES[number];
// Búsquedas acotadas de referencia; no equivalen a una correspondencia SKU aprobada.
export const SOURCE_TARGETS = [
  { id: 'ryzen-7600', category: 'cpu', brand: 'AMD', label: 'Ryzen 5 7600', query: 'Ryzen%205%207600' },
  { id: 'ryzen-9600x', category: 'cpu', brand: 'AMD', label: 'Ryzen 5 9600X', query: 'Ryzen%205%209600X' },
  { id: 'core-i5-14400', category: 'cpu', brand: 'Intel', label: 'Core i5-14400', query: 'Core%20i5%2014400' },
  { id: 'core-ultra-245k', category: 'cpu', brand: 'Intel', label: 'Core Ultra 5 245K', query: 'Core%20Ultra%205%20245K' },
  { id: 'rtx-4060', category: 'gpu', brand: 'NVIDIA', label: 'GeForce RTX 4060', query: 'RTX%204060' },
  { id: 'rtx-5060', category: 'gpu', brand: 'NVIDIA', label: 'GeForce RTX 5060', query: 'RTX%205060' },
  { id: 'rx-7600', category: 'gpu', brand: 'AMD', label: 'Radeon RX 7600', query: 'RX%207600' },
  { id: 'rx-9060xt', category: 'gpu', brand: 'AMD', label: 'Radeon RX 9060 XT', query: 'RX%209060%20XT' },
  { id: 'msi-b650', category: 'motherboard', brand: 'MSI', label: 'B650 · plataforma AM5', query: 'MSI%20B650' },
  { id: 'msi-b760', category: 'motherboard', brand: 'MSI', label: 'B760 · plataforma Intel', query: 'MSI%20B760' },
  { id: 'fury-ddr4', category: 'ram', brand: 'Kingston', label: 'FURY Beast DDR4 · módulos y kits', query: 'Kingston%20FURY%20Beast%20DDR4' },
  { id: 'fury-ddr5', category: 'ram', brand: 'Kingston', label: 'FURY Beast DDR5 · módulos y kits', query: 'Kingston%20FURY%20Beast%20DDR5' },
  { id: 'barracuda-hdd', category: 'storage', brand: 'Seagate', label: 'Barracuda · HDD', query: 'Seagate%20Barracuda' },
  { id: 'mx500-sata', category: 'storage', brand: 'Crucial', label: 'MX500 · SSD SATA', query: 'Crucial%20MX500' },
  { id: 'nv3-pcie', category: 'storage', brand: 'Kingston', label: 'NV3 · SSD PCIe M.2', query: 'Kingston%20NV3' },
  { id: 'ryzen-5600', category: 'cpu', brand: 'AMD', label: 'Ryzen 5 5600', query: 'Ryzen%205%205600' },
  { id: 'ryzen-5600g', category: 'cpu', brand: 'AMD', label: 'Ryzen 5 5600G · integrada', query: 'Ryzen%205%205600G' },
  { id: 'ryzen-7800x3d', category: 'cpu', brand: 'AMD', label: 'Ryzen 7 7800X3D', query: 'Ryzen%207%207800X3D' },
  { id: 'msi-b550-a-pro', category: 'motherboard', brand: 'MSI', label: 'B550-A PRO · AM4', query: 'MSI%20B550-A%20PRO' },
  { id: 'msi-4060-ventus', category: 'gpu', brand: 'MSI', label: 'RTX 4060 Ventus 2X Black OC', query: 'MSI%20RTX%204060%20Ventus%202X%20Black%208G%20OC' },
  { id: 'fury-rgb-ddr4-kit', category: 'ram', brand: 'Kingston', label: 'FURY Beast RGB · DDR4 · kit 2 × 8 GB', query: 'KF432C16BBAK2%2F16' },
  { id: 'a400-480-sata', category: 'storage', brand: 'Kingston', label: 'A400 · 480 GB · SATA', query: 'SA400S37%2F480G' },
  { id: '990-pro-1tb', category: 'storage', brand: 'Samsung', label: '990 PRO · 1 TB', query: 'MZ-V9P1T0' },
] as const;

export function sourceTarget(id: string) {
  const target = SOURCE_TARGETS.find(item => item.id === id);
  if (!target) return null;
  const categoryId = target.category === 'storage' ? (target.id === 'barracuda-hdd' ? 8 : 39) : { cpu: 3, gpu: 2, motherboard: 5, ram: 7 }[target.category];
  return { ...target, categoryId, url: `https://api.solotodo.com/products/?categories=${categoryId}&search=${target.query}&page_size=5`, terms: decodeURIComponent(target.query).split(/\s+/) };
}

export function matchesSourceTarget(name: string, chip: string, terms: readonly string[]) {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  const haystack = normalize(`${name} ${chip}`);
  return terms.every(term => haystack.includes(normalize(term)));
}
