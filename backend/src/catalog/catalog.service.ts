import { BadRequestException, Injectable, Optional } from "@nestjs/common";
import { PRODUCTS } from "./catalog.data";
import { CATALOG_VERSION } from "./catalog.types";
import { BuildDraftDto } from "../builds/build.dto";
import { CatalogPricingService } from './catalog-pricing.service';
import { CatalogImportService } from './catalog-import.service';
import { personalizeCatalog } from './catalog.personalization';

@Injectable()
export class CatalogService {
  constructor(@Optional() private readonly pricing?: CatalogPricingService, @Optional() private readonly imports?: CatalogImportService) {}
  list() {
    const priced = this.pricing?.apply(PRODUCTS) ?? PRODUCTS.map(p => ({ ...p, priceInfo: { kind: p.price === 0 ? 'included' as const : 'estimated' as const } }));
    const products = personalizeCatalog(this.imports?.merge(priced) ?? priced);
    return {
      version: CATALOG_VERSION,
      source: products.some(p => p.priceInfo?.kind === 'observed') ? 'reference-mixed-prices' : 'reference-manual',
      notice:
        "Las fichas distinguen precios consultados en SoloTodo de estimaciones manuales. El precio consultado es normal/publicado por una tienda de la primera página revisada, no el mínimo de todo el mercado; no incluye despacho ni garantiza stock o venta. Caduca a las 24 h de la fecha de la oferta. Las fotos pueden ser de familia.",
      products,
    };
  }

  resolve(draft: BuildDraftDto) {
    const products = this.list().products;
    const components: Array<(typeof PRODUCTS)[number] & { quantity: number }> =
      [];
    const add = (id: string | undefined, category: string, quantity = 1) => {
      if (!id) return;
      const item = products.find(
        (entry) => entry.id === id && entry.category === category,
      );
      if (!item)
        throw new BadRequestException(
          `Componente no disponible en ${category}. Actualiza el catálogo.`,
        );
      if (item.priceInfo?.kind === 'unavailable') throw new BadRequestException('El precio de esta pieza de SoloTodo venció o ya no tiene una oferta apta. Actualiza la fuente o elige otra pieza; no se cotizará como gratis.');
      components.push({ ...item, quantity });
    };
    for (const category of [
      "cpu",
      "gpu",
      "board",
      "cooler",
      "case",
      "psu",
    ] as const) {
      add(draft[category], category);
    }
    const selected = new Set<string>();
    if (draft.memory?.length && draft.ram)
      throw new BadRequestException("Usa memory o ram, no ambos a la vez.");
    const memory =
      draft.memory ?? (draft.ram ? [{ id: draft.ram, quantity: 1 }] : []);
    for (const item of memory) {
      if (selected.has(item.id))
        throw new BadRequestException(
          "Una memoria repetida debe usar cantidad.",
        );
      selected.add(item.id);
      add(item.id, "ram", item.quantity);
    }
    for (const item of draft.drives ?? []) {
      if (selected.has(item.id))
        throw new BadRequestException(
          "Una unidad repetida debe usar el campo cantidad.",
        );
      selected.add(item.id);
      add(item.id, "storage", item.quantity);
    }
    for (const item of draft.extras ?? []) {
      if (selected.has(item.id))
        throw new BadRequestException(
          "Un extra repetido debe usar el campo cantidad.",
        );
      selected.add(item.id);
      const category = products.find((entry) => entry.id === item.id)?.category;
      if (category !== "fan" && category !== "support")
        throw new BadRequestException("Extra no válido.");
      if (category === "support" && item.quantity !== 1)
        throw new BadRequestException("Solo se admite un soporte por armado.");
      add(item.id, category, item.quantity);
    }
    return {
      budget: draft.budget,
      intended_use: draft.intendedUse,
      catalog_version: CATALOG_VERSION,
      components,
    };
  }
}
