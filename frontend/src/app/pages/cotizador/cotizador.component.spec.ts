import "zone.js";
import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Catalogo, Producto } from "../../modelos/catalogo";
import { AuthService } from "../../servicios/autenticacion.service";
import { CatalogoService } from "../../servicios/catalogo.service";
import { QuoteService } from "../../servicios/cotizaciones.service";
import { CotizadorComponent } from "./cotizador.component";

const nvme: Producto = {
  id: "nvme",
  category: "storage",
  name: "NVMe 1 TB",
  description: "",
  price: 70000,
  icon: "nvme",
  specs: { kind: "NVMe", capacityGb: 1000 },
};
const hdd: Producto = {
  id: "hdd",
  category: "storage",
  name: "HDD 2 TB",
  description: "",
  price: 50000,
  icon: "hdd",
  specs: { kind: "HDD", capacityGb: 2000 },
};
const catalog: Catalogo = {
  version: "test",
  source: "reference-manual",
  notice: "",
  products: [
    nvme,
    hdd,
    {
      id: "ram8",
      category: "ram",
      name: "RAM 8 GB",
      description: "",
      price: 20000,
      icon: "ram",
      specs: { capacityGb: 8, modules: 1, ram: "DDR4", brand: "Kingston" },
    },
  ],
};

describe("Cotizador: selección y recuperación del armado", () => {
  const service = {
    cargar: vi.fn(() => of(catalog)),
    revisar: vi.fn(() => of({ missing: ["cpu"], issues: [], can_save: false })),
    guardar: vi.fn(),
  };
  const create = () =>
    TestBed.runInInjectionContext(() => new CotizadorComponent());

  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    vi.restoreAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: CatalogoService, useValue: service },
        { provide: AuthService, useValue: { user: undefined } },
        { provide: QuoteService, useValue: {} },
      ],
    });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    sessionStorage.clear();
    vi.useRealTimers();
  });

  it('comparte el separador decorativo debajo del título Arma tu PC', () => {
    TestBed.configureTestingModule({ imports: [CotizadorComponent], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(CotizadorComponent);
    fixture.detectChanges();
    const header = (fixture.nativeElement as HTMLElement).querySelector('.cabecera')!;
    expect(header.querySelector('h2')?.textContent).toBe('ARMA TU PC');
    expect(header.querySelector('h2 + .divider')?.getAttribute('aria-hidden')).toBe('true');
    expect(header.querySelectorAll('.divider')).toHaveLength(1);
    expect(header.querySelector('.divider + p')?.textContent).toContain('Un punto de partida');
  });

  it('el fondo de circuitos es decorativo y conserva la acción de Personalizado', () => {
    TestBed.configureTestingModule({ imports: [CotizadorComponent], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(CotizadorComponent);
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector('.personal-cta') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('Empezar armado personalizado');
    expect(button.querySelector('.personal-fondo')?.getAttribute('aria-hidden')).toBe('true');
    expect(button.querySelectorAll('.personal-datos path')).toHaveLength(4);
    const start = vi.spyOn(fixture.componentInstance, 'empezar').mockImplementation(() => {});
    button.click();
    expect(start).toHaveBeenCalledExactlyOnceWith('personalizado');
  });

  it('aclara el uso y no oculta piezas al cambiarlo', () => {
    TestBed.configureTestingModule({ imports: [CotizadorComponent], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(CotizadorComponent);
    fixture.componentInstance.inicio = 'personalizado';
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('#uso')?.getAttribute('aria-describedby')).toBe('ayuda-uso');
    expect(root.querySelector('#ayuda-uso')?.textContent).toContain('no limita las piezas');
    const before = fixture.componentInstance.productos('ram').map(p => p.id);
    expect(before).toEqual(['ram8']);
    fixture.componentInstance.preferencias.controls.intendedUse.setValue('oficina');
    fixture.detectChanges();
    expect(fixture.componentInstance.productos('ram').map(p => p.id)).toEqual(before);
  });

  it('cotizar otro vuelve a los presets y limpia solo el borrador local', () => {
    const cotizador = create();
    cotizador.elegir(hdd);
    cotizador.nombreCotizacion.setValue('PC guardado');
    cotizador.quoteId = 'guardada-en-servidor';
    cotizador.paso.set(11);
    cotizador.maxPaso = 10;
    cotizador.consultar = true;
    cotizador.coordinacionEnviada = true;
    cotizador.borradorRecuperado = true;
    cotizador.coordinacion.patchValue({ customerNote: 'Nota anterior', serviceAddress: 'Comuna anterior' });
    cotizador.cotizarOtro();
    expect(cotizador.paso()).toBe(1);
    expect(cotizador.inicio).toBe('presets');
    expect(cotizador.maxPaso).toBe(1);
    expect(cotizador.selecciones()).toEqual([]);
    expect(cotizador.quoteId).toBe('');
    expect(cotizador.consultar).toBe(false);
    expect(cotizador.coordinacionEnviada).toBe(false);
    expect(cotizador.borradorRecuperado).toBe(false);
    expect(cotizador.coordinacion.controls.customerNote.value).toBe('');
    expect(cotizador.coordinacion.controls.serviceAddress.value).toBe('');
    expect(service.guardar).not.toHaveBeenCalled();
    expect(create().borrador().drives).toEqual([]);
  });
  it('pide confirmación antes de descartar un borrador sin guardar', () => {
    const cotizador = create();
    cotizador.elegir(hdd);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    cotizador.cotizarOtro();
    expect(confirm).toHaveBeenCalledOnce();
    expect(cotizador.borrador().drives).toHaveLength(1);
    confirm.mockReturnValue(true);
    cotizador.cotizarOtro();
    expect(cotizador.selecciones()).toEqual([]);
  });
  it('no reinicia mientras guarda o envía una consulta', () => {
    const cotizador = create();
    cotizador.elegir(hdd);
    cotizador.guardando = true;
    cotizador.cotizarOtro();
    expect(cotizador.borrador().drives).toHaveLength(1);
    cotizador.guardando = false;
    cotizador.enviando = true;
    cotizador.cotizarOtro();
    expect(cotizador.borrador().drives).toHaveLength(1);
  });
  it('el enlace Nueva cotización no recupera piezas del armado anterior', () => {
    sessionStorage.setItem('jembatech-armado-ep2', JSON.stringify({
      version: 'test', draft: { budget: 1000000, intendedUse: 'gaming', drives: [{ id: 'hdd', quantity: 1 }], extras: [] },
      step: 11, maxStep: 10, start: 'personalizado',
    }));
    TestBed.configureTestingModule({ providers: [
      { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({ nuevo: '1' })) } },
      { provide: Router, useValue: { navigate: vi.fn(() => Promise.resolve(true)) } },
    ] });
    const next = create();
    expect(next.inicio).toBe('presets');
    expect(next.borrador().drives).toEqual([]);
    expect(next.borradorRecuperado).toBe(false);
  });
  it('descarta respuestas de compatibilidad anteriores al reiniciar', () => {
    vi.useFakeTimers();
    const anterior = new Subject<any>();
    service.revisar.mockReturnValueOnce(anterior as never);
    const cotizador = create();
    vi.advanceTimersByTime(180);
    cotizador.quoteId = 'guardada';
    cotizador.cotizarOtro();
    anterior.next({ missing: [], issues: [], can_save: true });
    expect(cotizador.analisis()).toBeUndefined();
    vi.advanceTimersByTime(180);
    expect(cotizador.analisis()?.can_save).toBe(false);
  });

  it("suma precio y capacidad de unidades mixtas por cantidad", () => {
    const cotizador = create();
    cotizador.elegir(nvme);
    cotizador.elegir(hdd);
    cotizador.elegir(hdd);
    expect(cotizador.total()).toBe(170000);
    expect(cotizador.capacidad()).toBe(5000);
    expect(cotizador.borrador().budget).toBe(1000000);
  });

  it("quita una pieza única sin borrar las otras selecciones", () => {
    const cotizador = create();
    const cpu: Producto = { ...nvme, id: "cpu-test", category: "cpu" };
    cotizador.elegir(cpu);
    cotizador.elegir(hdd);
    cotizador.quitar(cpu);
    expect(cotizador.borrador().cpu).toBeUndefined();
    expect(cotizador.cantidadProducto(hdd)).toBe(1);
    cotizador.quitar(hdd);
    expect(cotizador.cantidadProducto(hdd)).toBe(0);
  });

  it("agrega dos módulos iguales y conserva cantidades dentro de la tarjeta", () => {
    const cotizador = create();
    const memory = catalog.products.find((p) => p.id === "ram8")!;
    cotizador.elegir(memory);
    cotizador.elegir(memory);
    expect(cotizador.borrador().memory).toEqual([{ id: "ram8", quantity: 2 }]);
    expect(cotizador.cantidadProducto(memory)).toBe(2);
    expect(cotizador.total()).toBe(40000);
    cotizador.cambiarCantidad(memory, 1);
    expect(cotizador.total()).toBe(20000);
  });

  it('muestra los avisos detallados únicamente en Resumen, no en selección ni guardado', () => {
    TestBed.configureTestingModule({ imports: [CotizadorComponent], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(CotizadorComponent);
    const c = fixture.componentInstance;
    c.analisis.set({ total_price: 0, ram_gb: 0, storage_gb: 0, psu_watts: 0, estimated_consumption_watts: 0, recommended_watts: 0, remaining_budget: 1000000, missing: [], can_save: true, score: 70, level: 'Revisión parcial', warnings: [], recommendations: [], explanation: '', issues: [{ category: 'board', severity: 'warning', message: 'Confirmar QVL' }] });
    for (const step of [5, 9, 11]) { c.paso.set(step); fixture.detectChanges(); expect(fixture.nativeElement.querySelector('.problemas')).toBeNull(); }
    c.paso.set(10); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.problemas')?.textContent).toContain('Confirmar QVL');
  });

  it('entra a fuentes sin fijar automáticamente la potencia recomendada', () => {
    const c = create(); c.maxPaso = 9; c.potenciaFiltro = 650;
    c.ir(9);
    expect(c.potenciaFiltro).toBe(0); expect(c.modularidad).toBe('Todas'); expect(c.mostrarIncompatibles).toBe(true);
  });

  it("conserva el nombre al recuperar el borrador", () => {
    const first = create();
    first.nombreCotizacion.setValue("PC de estudio");
    expect(create().nombreCotizacion.value).toBe("PC de estudio");
  });

  it("separa aire, AIO y cooler incluido, sin filtrar los accesorios por tipo", () => {
    service.cargar.mockReturnValueOnce(
      of({
        ...catalog,
        products: [
          ...catalog.products,
          ...["stock", "air", "aio"].map((kind) => ({
            id: `cooler-${kind}`,
            category: "cooler" as const,
            name: kind,
            description: "",
            price: 1,
            icon: "cooler",
            specs: { kind, sockets: ["AM4", "AM5", "LGA1700"] },
          })),
          {
            id: "fan",
            category: "fan" as const,
            name: "Fan",
            description: "",
            price: 1,
            icon: "fan",
            specs: { sizeMm: 120 },
          },
        ],
      }),
    );
    const cotizador = create();
    cotizador.tipoCooler = "air";
    expect(cotizador.refrigeraciones("air").map((p) => p.id)).toEqual([
      "cooler-air",
    ]);
    expect(cotizador.refrigeraciones("stock").map((p) => p.id)).toEqual([
      "cooler-stock",
    ]);
    expect(cotizador.refrigeraciones("aio")).toEqual([]);
    cotizador.tipoCooler = "aio";
    expect(cotizador.refrigeraciones("aio").map((p) => p.id)).toEqual([
      "cooler-aio",
    ]);
    expect(cotizador.productos("fan").map((p) => p.id)).toEqual(["fan"]);
  });

  it("recupera un borrador de versión 2 al actualizar el catálogo", () => {
    const first = create();
    first.elegir(hdd);
    const saved = JSON.parse(sessionStorage.getItem("jembatech-armado-ep2")!);
    saved.version = "ep2-reference-2";
    sessionStorage.setItem("jembatech-armado-ep2", JSON.stringify(saved));
    expect(create().borrador().drives).toEqual([{ id: "hdd", quantity: 1 }]);
  });

  it("permite previsualizar sin sustituir las piezas ni avanzar", () => {
    const cotizador = create();
    cotizador.elegir(hdd);
    cotizador.alternarVistaPrevia("gaming");
    expect(cotizador.vistaPrevia).toBe("gaming");
    expect(cotizador.paso()).toBe(1);
    expect(cotizador.borrador().drives).toEqual([{ id: "hdd", quantity: 1 }]);
    cotizador.alternarVistaPrevia("creador");
    expect(cotizador.vistaPrevia).toBe("creador");
    cotizador.alternarVistaPrevia("creador");
    expect(cotizador.vistaPrevia).toBeNull();
  });

  it("migra el inicio presupuesto antiguo a personalizado sin perder piezas", () => {
    const first = create();
    first.elegir(hdd);
    const saved = JSON.parse(sessionStorage.getItem("jembatech-armado-ep2")!);
    saved.start = "presupuesto";
    sessionStorage.setItem("jembatech-armado-ep2", JSON.stringify(saved));
    const restored = create();
    expect(restored.inicio).toBe("personalizado");
    expect(restored.borrador().drives).toEqual([{ id: "hdd", quantity: 1 }]);
  });

  it("personalizado empieza de cero sin arrastrar piezas del preset anterior", () => {
    const cotizador = create();
    cotizador.elegir(hdd);
    cotizador.empezar("personalizado");
    expect(cotizador.selecciones()).toEqual([]);
    expect(cotizador.inicio).toBe("personalizado");
    expect(cotizador.maxPaso).toBe(1);
  });

  it("recupera las selecciones después de navegar al login", () => {
    const first = create();
    first.elegir(nvme);
    first.cantidad("drives", nvme.id, 2);
    const restored = create();
    expect(restored.borradorRecuperado).toBe(true);
    expect(restored.borrador().drives).toEqual([{ id: "nvme", quantity: 2 }]);
    expect(restored.capacidad()).toBe(2000);
  });

  it("al quitar la última unidad elimina la selección y descarta la evaluación anterior", () => {
    const cotizador = create();
    cotizador.elegir(nvme);
    cotizador.quoteId = "quote-anterior";
    cotizador.cantidad("drives", nvme.id, 0);
    expect(cotizador.borrador().drives).toEqual([]);
    expect(cotizador.quoteId).toBe("");
    expect(cotizador.analisis()).toBeUndefined();
    expect(cotizador.puedeSeguir()).toBe(false);
  });

  it("no restaura un catálogo anterior ni permite cantidades fuera de rango", () => {
    sessionStorage.setItem(
      "jembatech-armado-ep2",
      JSON.stringify({
        version: "old",
        draft: {
          budget: 900000,
          intendedUse: "gaming",
          drives: [{ id: "nvme", quantity: 3 }],
          extras: [],
        },
      }),
    );
    const cotizador = create();
    expect(cotizador.borradorRecuperado).toBe(false);
    cotizador.elegir(nvme);
    cotizador.cantidad("drives", nvme.id, 9);
    expect(cotizador.borrador().drives[0].quantity).toBe(1);
  });
});
