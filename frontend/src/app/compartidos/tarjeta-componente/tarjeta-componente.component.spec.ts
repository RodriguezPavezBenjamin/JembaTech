import 'zone.js';
import { describe, expect, it, vi } from "vitest";
import { TarjetaComponenteComponent } from "./tarjeta-componente.component";
import { Producto } from "../../modelos/catalogo";
import { TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';

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
  it('distingue capacidad por módulo de un kit anterior', () => {
    const card = new TarjetaComponenteComponent();
    card.producto = product('ram', { capacityGb: 64, modules: 1, speed: 5600 });
    expect(card.caracteristicas()).toContainEqual({ label: 'POR MÓDULO', value: '64 GB' });
    expect(card.caracteristicas()).toContainEqual({ label: 'PRESENTACIÓN', value: '1 módulo · cantidad elegible' });
    card.producto = product('ram', { capacityGb: 64, modules: 2 });
    expect(card.caracteristicas()).toContainEqual({ label: 'POR MÓDULO', value: '32 GB' });
  });
  it('el precio importado sin oferta no se rotula como estimado ni incluido', () => {
    TestBed.resetTestingModule();
    try {
      TestBed.configureTestingModule({ imports: [TarjetaComponenteComponent] });
      const fixture = TestBed.createComponent(TarjetaComponenteComponent);
      fixture.componentInstance.producto = { ...product('case', { forms: ['ATX'], gpuClearanceMm: 360, coolerClearanceMm: 170, bays25: 2, bays35: 2, unverified: ['confirmar formatos de placa admitidos'] }), priceInfo: { kind: 'unavailable' }, image: 'https://media.solotodo.com/media/products/photo.avif', imageSource: 'https://www.solotodo.cl/products/1' };
      fixture.componentInstance.fotoFallida = true; fixture.detectChanges();
      const text = (fixture.nativeElement as HTMLElement).textContent;
      expect(text).toContain('Precio por actualizar'); expect(text).toContain('SIN OFERTA VIGENTE');
      expect(text).toContain('Foto no disponible'); expect(text).not.toContain('PRECIO ESTIMADO');
      expect(fixture.componentInstance.formatoOrientativo).toBe(true);
    } finally { TestBed.resetTestingModule(); }
  });
  it('una foto corregida se vuelve a mostrar sin reintentar en bucle una URL rota', () => {
    const card = new TarjetaComponenteComponent();
    const previous = { ...product('cpu', {}), image: 'https://media.solotodo.com/media/products/old.jpg' };
    const next = { ...previous, image: 'https://media.solotodo.com/media/products/new.avif' };
    card.fotoFallida = true;
    card.ngOnChanges({ producto: new SimpleChange(previous, next, false) });
    expect(card.fotoFallida).toBe(false);
    card.fotoFallida = true;
    card.ngOnChanges({ producto: new SimpleChange(next, { ...next }, false) });
    expect(card.fotoFallida).toBe(true);
  });
  it('datos ausentes no se muestran como cero, sin Wi-Fi ni NaN', () => {
    const card = new TarjetaComponenteComponent();
    card.producto = product('board', { ramSlots: 4, ram: 'DDR5' });
    expect(card.caracteristicas().find(c => c.label === 'CAPACIDAD RAM')?.value).toBe('Por confirmar');
    expect(card.caracteristicas().find(c => c.label === 'INALÁMBRICO')?.value).toBe('Por confirmar');
    card.producto = product('case', { forms: ['ATX'], gpuClearanceMm: 360, coolerClearanceMm: 170, bays25: 2, bays35: 2 });
    expect(card.caracteristicas().find(c => c.label === 'VENTILADORES')?.value).toBe('Por confirmar');
    expect(card.caracteristicas().some(c => /NaN|undefined/.test(c.value))).toBe(false);
  });
  it('distingue precio consultado de estimado y sus detalles no seleccionan la tarjeta', () => {
    TestBed.resetTestingModule();
    // La oferta de esta fixture vence el 19/10; fijar solo el reloj consultado,
    // sin deshabilitar la caducidad ni depender de la fecha real de CI.
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-18T12:00:00Z'));
    try {
      TestBed.configureTestingModule({ imports: [TarjetaComponenteComponent] });
      const fixture = TestBed.createComponent(TarjetaComponenteComponent);
      const card = fixture.componentInstance;
      card.producto = product('cpu', {}); fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('PRECIO ESTIMADO');
      card.producto = { ...card.producto, price: 230000, priceInfo: { kind: 'observed', source: 'SoloTodo', currency: 'CLP', externalId: '166287', partNumber: null, storeHost: 'tienda.example.cl', offerUrl: 'https://tienda.example.cl/p', sourceUrl: 'https://www.solotodo.cl/products/166287', observedAt: '2026-10-18T03:00:00Z', offerUpdatedAt: '2026-10-18T02:00:00Z', expiresAt: '2026-10-19T02:00:00Z', normalPriceClp: 230000, offerPriceClp: 210000, scope: 'first-page' } }; fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('PRECIO CONSULTADO · NORMAL');
      expect(fixture.nativeElement.textContent).toContain('tienda.example.cl');
      const add = vi.spyOn(card.elegir, 'emit');
      (fixture.nativeElement.querySelector('.precio-origen summary') as HTMLElement).click();
      expect(add).not.toHaveBeenCalled();
    } finally { clock.mockRestore(); TestBed.resetTestingModule(); }
  });
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
