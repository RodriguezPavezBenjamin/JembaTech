export type Categoria =
  | "cpu"
  | "gpu"
  | "board"
  | "ram"
  | "storage"
  | "cooler"
  | "fan"
  | "support"
  | "case"
  | "psu";

export interface Producto {
  id: string;
  category: Categoria;
  name: string;
  description: string;
  price: number;
  priceInfo?: { kind: 'estimated' | 'included' | 'unavailable' } | PrecioConsultado;
  icon: string;
  image?: string;
  imageSource?: string;
  imageLabel?: string;
  imageLicense?: string;
  specs: Record<string, string | number | boolean | string[] | number[]>;
}

export interface PrecioConsultado {
  kind: 'observed'; source: 'SoloTodo'; currency: 'CLP'; externalId: string; partNumber: string | null;
  storeHost: string; offerUrl: string; sourceUrl: string; observedAt: string; offerUpdatedAt: string;
  expiresAt: string; normalPriceClp: number; offerPriceClp: number; scope: 'first-page';
}

export interface Catalogo {
  version: string;
  source: string;
  notice: string;
  products: Producto[];
}

export interface Cantidad {
  id: string;
  quantity: number;
}

export interface Borrador {
  name?: string;
  memory?: Cantidad[];
  budget: number;
  intendedUse: string;
  cpu?: string;
  gpu?: string;
  board?: string;
  ram?: string;
  cooler?: string;
  case?: string;
  psu?: string;
  drives: Cantidad[];
  extras: Cantidad[];
}

export interface Analisis {
  total_price: number;
  ram_gb: number;
  storage_gb: number;
  psu_watts: number;
  estimated_consumption_watts: number;
  recommended_watts: number;
  remaining_budget: number;
  missing: string[];
  issues: {
    category: string;
    severity: "block" | "warning";
    message: string;
  }[];
  can_save: boolean;
  score: number;
  level: string;
  warnings: string[];
  recommendations: string[];
  explanation: string;
  quoteId?: string;
}
