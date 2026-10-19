import { PriceInfo } from './catalog.pricing';

export type ProductCategory =
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

export interface CatalogProduct {
  id: string;
  category: ProductCategory;
  name: string;
  description: string;
  price: number;
  priceInfo?: PriceInfo;
  icon: string;
  image?: string;
  imageSource?: string;
  imageLabel?: string;
  imageLicense?: string;
  specs: Record<string, string | number | boolean | string[] | number[]>;
}

export const CATALOG_VERSION = "ep2-reference-3";
