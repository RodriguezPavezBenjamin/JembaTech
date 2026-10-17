import { describe, expect, it, vi } from "vitest";
import { TarjetaComponenteComponent } from "./tarjeta-componente.component";
import { Producto } from "../../modelos/catalogo";

const product = (
  category: Producto["category"],
  specs: Producto["specs"],
): Producto => ({
  id: "test",
  category,
  name: "Modelo",
  description: "",
  price: 1,
  icon: category,
  specs,
});
describe("Fichas de hardware", () => {
  it("alterna agregar y quitar una selección única", () => {
    const card = new TarjetaComponenteComponent();
    card.producto = product("board", {});
    const add = vi.spyOn(card.elegir, "emit");
    const remove = vi.spyOn(card.quitar, "emit");
    card.alternar();
    expect(add).toHaveBeenCalledExactlyOnceWith(card.producto);
    card.seleccionado = true;
    card.alternar();
    expect(remove).toHaveBeenCalledExactlyOnceWith(card.producto);
  });
  it("quita todas las unidades al pulsar una tarjeta múltiple seleccionada", () => {
    const card = new TarjetaComponenteComponent();
    card.producto = product("storage", {});
    card.multiple = true;
    card.cantidad = 3;
    const quantity = vi.spyOn(card.cantidadCambio, "emit");
    const add = vi.spyOn(card.elegir, "emit");
    card.alternar();
    expect(quantity).toHaveBeenCalledExactlyOnceWith(0);
    expect(add).not.toHaveBeenCalled();
  });
  it("bloquea agregar incompatibles pero permite quitar los ya seleccionados", () => {
    const card = new TarjetaComponenteComponent();
    card.producto = product("gpu", {});
    card.motivo = "No compatible";
    const add = vi.spyOn(card.elegir, "emit");
    const remove = vi.spyOn(card.quitar, "emit");
    card.alternar();
    expect(add).not.toHaveBeenCalled();
    card.seleccionado = true;
    card.alternar();
    expect(remove).toHaveBeenCalledOnce();
    card.ocupado = true;
    card.alternar();
    expect(remove).toHaveBeenCalledOnce();
  });
  it("muestra slots, capacidad y puertos de placa sin inventar datos", () => {
    const card = new TarjetaComponenteComponent();
    card.producto = product("board", {
      ramSlots: 2,
      ram: "DDR5",
      maxRam: 128,
      m2: 2,
      sata: 4,
      form: "Mini-ITX",
      wifi: true,
      lan: "2.5 GbE",
      wireless: "Wi-Fi 6E",
    });
    expect(card.caracteristicas()).toContainEqual({
      label: "MEMORIA",
      value: "2 slots · DDR5",
    });
    expect(card.caracteristicas()).toContainEqual({
      label: "ALMACENAMIENTO",
      value: "2 M.2 · 4 SATA",
    });
  });
  it("distingue integrada de tarjeta dedicada", () => {
    const card = new TarjetaComponenteComponent();
    card.producto = product("gpu", { integrated: true });
    expect(card.integrada).toBe(true);
    card.producto = product("gpu", { integrated: false });
    expect(card.integrada).toBe(false);
  });
  it("en AIO muestra radiador y cantidad incluida, no altura de torre", () => {
    const card = new TarjetaComponenteComponent();
    card.producto = product("cooler", {
      kind: "aio",
      radiatorMm: 240,
      includedFans: 2,
      sockets: ["AM4", "AM5"],
    });
    expect(card.caracteristicas()).toContainEqual({
      label: "RADIADOR",
      value: "240 mm",
    });
    expect(card.caracteristicas()).toContainEqual({
      label: "VENTILADORES",
      value: "2 incluidos",
    });
  });
});
