import { BadRequestException, Injectable } from "@nestjs/common";
import { PRODUCTS } from "./catalog.data";
import { CATALOG_VERSION } from "./catalog.types";
import { BuildDraftDto } from "../builds/build.dto";

@Injectable()
export class CatalogService {
  list() {
    return {
      version: CATALOG_VERSION,
      source: "reference-manual",
      notice:
        "Catálogo manual con modelos y fotos de fabricantes/editores identificados. Precios estimados, sin stock en tiempo real. Algunos componentes siguen siendo perfiles de montaje; las fotos de familia no garantizan la presentación exacta.",
      products: PRODUCTS,
    };
  }

  resolve(draft: BuildDraftDto) {
    const components: Array<(typeof PRODUCTS)[number] & { quantity: number }> =
      [];
    const add = (id: string | undefined, category: string, quantity = 1) => {
      if (!id) return;
      const item = PRODUCTS.find(
        (entry) => entry.id === id && entry.category === category,
      );
      if (!item)
        throw new BadRequestException(
          `Componente no disponible en ${category}. Actualiza el catálogo.`,
        );
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
      const category = PRODUCTS.find((entry) => entry.id === item.id)?.category;
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
