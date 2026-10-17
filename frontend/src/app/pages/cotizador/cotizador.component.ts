import { CommonModule } from "@angular/common";
import { Component, DestroyRef, computed, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { catchError, of, Subject, switchMap, timer } from "rxjs";
import { TarjetaComponenteComponent } from "../../compartidos/tarjeta-componente/tarjeta-componente.component";
import {
  Analisis,
  Borrador,
  Cantidad,
  Categoria,
  Catalogo,
  Producto,
} from "../../modelos/catalogo";
import { AuthService } from "../../servicios/autenticacion.service";
import { CatalogoService } from "../../servicios/catalogo.service";
import { QuoteService } from "../../servicios/cotizaciones.service";
import { PRESETS, Preset, draftFromPreset, presetPrice } from "./presets";

type SeleccionUnica =
  "cpu" | "gpu" | "board" | "ram" | "cooler" | "case" | "psu";
const CLAVE_BORRADOR = "jembatech-armado-ep2";
const USOS = ["oficina", "estudio", "gaming", "programacion", "edicion"];
const UNICAS: SeleccionUnica[] = [
  "cpu",
  "gpu",
  "board",
  "ram",
  "cooler",
  "case",
  "psu",
];

@Component({
  selector: "app-cotizador",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    TarjetaComponenteComponent,
  ],
  templateUrl: "./cotizador.component.html",
  styleUrl: "./cotizador.component.scss",
})
export class CotizadorComponent {
  readonly Math = Math;
  private readonly servicio = inject(CatalogoService);
  readonly autenticacion = inject(AuthService);
  private readonly cotizaciones = inject(QuoteService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly solicitudes = new Subject<Borrador | null>();
  private readonly ruta = inject(ActivatedRoute, { optional: true });
  private readonly router = this.ruta ? inject(Router) : null;
  private nuevoSolicitado = false;

  readonly pasos = [
    "INICIO",
    "CPU",
    "GRÁFICA",
    "PLACA",
    "RAM",
    "DISCOS",
    "EXTRAS",
    "GABINETE",
    "FUENTE",
    "RESUMEN",
  ];
  readonly titulos = [
    "ELIGE CÓMO EMPEZAR",
    "EL CORAZÓN DE TU EQUIPO",
    "DALE VIDA A TU PANTALLA",
    "TODO PARTE DE UNA BUENA BASE",
    "ESPACIO PARA HACER MÁS",
    "TUS ARCHIVOS, A TU MANERA",
    "REFRIGERACIÓN Y EXTRAS",
    "UN HOGAR PARA TUS PIEZAS",
    "ENERGÍA PARA TODO TU ARMADO",
    "ASÍ QUEDA TU PC",
  ];
  readonly categorias: Record<string, string> = {
    cpu: "Procesador",
    gpu: "Gráfica",
    board: "Placa madre",
    ram: "Memoria RAM",
    storage: "Almacenamiento",
    cooler: "Refrigeración",
    fan: "Ventiladores",
    support: "Soporte",
    case: "Gabinete",
    psu: "Fuente",
    budget: "Presupuesto",
  };
  readonly categoriaPorPaso: Record<number, Categoria> = {
    2: "cpu",
    3: "gpu",
    4: "board",
    5: "ram",
    6: "storage",
    7: "cooler",
    8: "case",
    9: "psu",
  };
  readonly preferencias = this.fb.nonNullable.group({
    budget: [
      1000000,
      [
        Validators.required,
        Validators.min(1),
        Validators.max(100000000),
        Validators.pattern(/^\d+$/),
      ],
    ],
    intendedUse: ["gaming", Validators.required],
  });
  readonly coordinacion = this.fb.nonNullable.group({
    contactPhone: [
      "",
      [Validators.required, Validators.pattern(/^\+?[\d\s-]{8,30}$/)],
    ],
    preferredDate: [""],
    serviceAddress: [""],
    customerNote: [""],
  });
  readonly nombreCotizacion = this.fb.nonNullable.control("Mi PC", [
    Validators.required,
    Validators.maxLength(80),
    Validators.pattern(/\S/),
  ]);
  readonly presets = PRESETS;
  inicio: "presets" | "personalizado" = "presets";
  vistaPrevia: string | null = null;
  maxPaso = 1;
  consultar = false;
  coordinacionEnviada = false;
  readonly borrador = signal<Borrador>({
    budget: 1000000,
    intendedUse: "gaming",
    drives: [],
    extras: [],
  });
  readonly catalogo = signal<Catalogo | undefined>(undefined);
  readonly analisis = signal<Analisis | undefined>(undefined);
  readonly paso = signal(1);
  readonly selecciones = computed(() => {
    const state = this.borrador();
    const items = UNICAS.flatMap((key) =>
      state[key] ? [{ id: state[key]!, quantity: 1 }] : [],
    );
    const memory = state.memory ?? [];
    const order: Categoria[] = [
      "cpu",
      "gpu",
      "board",
      "ram",
      "storage",
      "cooler",
      "fan",
      "support",
      "case",
      "psu",
    ];
    return [...items, ...memory, ...state.drives, ...state.extras]
      .flatMap((item) => {
        const product = this.producto(item.id);
        return product ? [{ ...product, quantity: item.quantity }] : [];
      })
      .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
  });
  readonly total = computed(() =>
    this.selecciones().reduce((sum, p) => sum + p.price * p.quantity, 0),
  );
  readonly capacidad = computed(() =>
    this.selecciones()
      .filter((p) => p.category === "storage")
      .reduce((sum, p) => sum + Number(p.specs["capacityGb"]) * p.quantity, 0),
  );

  cargando = true;
  revisando = false;
  guardando = false;
  enviando = false;
  error = "";
  mensaje = "";
  quoteId = "";
  borradorRecuperado = false;
  busqueda = "";
  marcaCpu = "";
  marcaGpu = "";
  marcaRam = "Todas";
  marcaDisco = "Todas";
  ramCapacidad = 0;
  ramRgb = "Todas";
  tipoDisco = "NVMe";
  capacidadFiltro = 1000;
  formaFiltro = "Todas";
  modularidad = "Todas";
  potenciaFiltro = 0;
  tipoCooler = "Todos";
  mostrarIncompatibles = false;

  constructor() {
    this.coordinacion.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.persistir());
    this.nombreCotizacion.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((name) => {
        this.borrador.update((draft) => ({ ...draft, name }));
        this.persistir();
      });
    this.solicitudes
      .pipe(
        switchMap((draft) =>
          draft
            ? timer(180).pipe(switchMap(() => this.servicio.revisar(draft).pipe(
                catchError((error) => {
                  this.error =
                    error?.error?.message ||
                    "No pudimos revisar tu armado. Comprueba que las APIs estén disponibles.";
                  return of(undefined);
                }),
              )))
            : of(undefined),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.analisis.set(result);
        this.revisando = false;
      });
    this.preferencias.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.preferencias.valid)
          this.actualizar(this.preferencias.getRawValue());
        else {
          this.analisis.set(undefined);
          this.revisando = false;
          this.solicitudes.next(null);
        }
      });
    this.ruta?.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      if (params.get('nuevo') !== '1') return;
      this.nuevoSolicitado = true;
      if (this.catalogo()) this.iniciarNuevo();
      void this.router?.navigate([], { relativeTo: this.ruta, queryParams: { nuevo: null }, queryParamsHandling: 'merge', fragment: 'cotizador', replaceUrl: true });
    });
    this.cargar();
  }

  cargar() {
    this.cargando = true;
    this.error = "";
    this.servicio
      .cargar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (catalog) => {
          this.catalogo.set(catalog);
          this.cargando = false;
          if (this.nuevoSolicitado) this.iniciarNuevo();
          else { this.recuperar(); this.recalcular(); }
        },
        error: () => {
          this.cargando = false;
          this.error =
            "No se pudo cargar el catálogo. Tus selecciones locales se conservaron.";
        },
      });
  }

  producto(id: string | undefined) {
    return this.catalogo()?.products.find((p) => p.id === id);
  }

  elegido(product: Producto) {
    const draft = this.borrador();
    if (product.category === "ram") return this.cantidadProducto(product) > 0;
    return UNICAS.includes(product.category as SeleccionUnica)
      ? draft[product.category as SeleccionUnica] === product.id
      : [...draft.drives, ...draft.extras].some(
          (item) => item.id === product.id,
        );
  }

  elegir(product: Producto) {
    if (this.guardando) return;
    if (
      product.category === "ram" ||
      product.category === "storage" ||
      product.category === "fan" ||
      product.category === "support"
    ) {
      const field =
        product.category === "ram"
          ? "memory"
          : product.category === "storage"
            ? "drives"
            : "extras";
      const items = this.borrador()[field] ?? [];
      const current = items.find((item) => item.id === product.id);
      if (current) {
        this.cantidad(field, product.id, current.quantity + 1);
      } else if (items.length < 8) {
        this.actualizar({
          [field]: [...items, { id: product.id, quantity: 1 }],
        });
      }
    } else {
      this.actualizar({ [product.category]: product.id });
    }
  }

  quitar(product: Producto) {
    if (this.guardando || !this.elegido(product)) return;
    if (UNICAS.includes(product.category as SeleccionUnica)) {
      this.actualizar({ [product.category]: undefined });
    } else {
      this.cambiarCantidad(product, 0);
    }
  }

  cantidad(
    field: "memory" | "drives" | "extras",
    id: string,
    quantity: number,
  ) {
    if (this.guardando) return;
    const max = this.producto(id)?.category === "support" ? 1 : 8;
    if (quantity > max) return;
    const items = (this.borrador()[field] ?? []).flatMap((item) =>
      item.id === id ? (quantity > 0 ? [{ id, quantity }] : []) : [item],
    );
    this.actualizar({
      [field]: items,
      ...(field === "memory" ? { ram: undefined } : {}),
    });
  }

  cantidadProducto(product: Producto) {
    const field =
      product.category === "ram"
        ? "memory"
        : product.category === "storage"
          ? "drives"
          : "extras";
    return (
      (this.borrador()[field] ?? []).find((item) => item.id === product.id)
        ?.quantity ?? 0
    );
  }

  cambiarCantidad(product: Producto, quantity: number) {
    const field =
      product.category === "ram"
        ? "memory"
        : product.category === "storage"
          ? "drives"
          : "extras";
    this.cantidad(field, product.id, quantity);
  }

  precioPreset(preset: Preset) {
    return presetPrice(preset, this.catalogo()?.products ?? []);
  }

  usarPreset(preset: Preset, budget = preset.budget) {
    if (this.guardando || this.precioPreset(preset) === undefined) return;
    this.vistaPrevia = null;
    const draft = draftFromPreset(preset, budget);
    this.borrador.set(draft);
    this.preferencias.setValue(
      { budget, intendedUse: preset.use },
      { emitEvent: false },
    );
    this.nombreCotizacion.setValue(preset.name, { emitEvent: false });
    this.maxPaso = 10;
    this.paso.set(10);
    this.quoteId = "";
    this.consultar = false;
    this.coordinacionEnviada = false;
    this.recalcular();
    this.enfocar();
  }

  alternarVistaPrevia(id: string) {
    this.vistaPrevia = this.vistaPrevia === id ? null : id;
  }

  empezar(mode: "personalizado" | "presets") {
    const { budget, intendedUse } = this.preferencias.getRawValue();
    this.borrador.set({
      budget,
      intendedUse,
      memory: [],
      drives: [],
      extras: [],
      name: "Mi PC",
    });
    this.nombreCotizacion.setValue("Mi PC", { emitEvent: false });
    this.maxPaso = 1;
    this.quoteId = "";
    this.marcaCpu = "";
    this.marcaGpu = "";
    this.marcaRam = "Todas";
    this.marcaDisco = "Todas";
    this.ramCapacidad = 0;
    this.ramRgb = "Todas";
    this.capacidadFiltro = 0;
    this.busqueda = "";
    this.consultar = false;
    this.coordinacionEnviada = false;
    this.inicio = mode;
    this.vistaPrevia = null;
    this.paso.set(1);
    this.mensaje = "";
    this.recalcular();
  }

  cotizarOtro() {
    if (this.guardando || this.enviando) return;
    if (!this.quoteId && this.selecciones().length && !window.confirm('Este borrador todavía no se ha guardado. ¿Quieres descartarlo y cotizar otro PC? Tus cotizaciones guardadas se conservarán.')) return;
    this.iniciarNuevo();
  }

  private iniciarNuevo() {
    if (this.guardando || this.enviando) return;
    this.nuevoSolicitado = false;
    this.preferencias.reset({ budget: 1000000, intendedUse: 'gaming' }, { emitEvent: false });
    this.coordinacion.reset({ contactPhone: this.autenticacion.user?.phone ?? '', preferredDate: '', serviceAddress: '', customerNote: '' }, { emitEvent: false });
    this.borradorRecuperado = false;
    this.tipoDisco = 'NVMe';
    this.formaFiltro = 'Todas';
    this.modularidad = 'Todas';
    this.potenciaFiltro = 0;
    this.tipoCooler = 'Todos';
    this.mostrarIncompatibles = false;
    this.empezar('presets');
    this.enfocar();
  }

  capacidadesDisco() {
    return [
      ...new Set(
        (this.catalogo()?.products ?? [])
          .filter(
            (p) =>
              p.category === "storage" &&
              !p.specs["legacy"] &&
              p.specs["kind"] === this.tipoDisco,
          )
          .map((p) => Number(p.specs["capacityGb"])),
      ),
    ].sort((a, b) => a - b);
  }

  marcas(category: Categoria) {
    return [
      ...new Set(
        (this.catalogo()?.products ?? [])
          .filter((p) => p.category === category && !p.specs["legacy"])
          .map((p) => String(p.specs["brand"] ?? ""))
          .filter(Boolean),
      ),
    ];
  }

  actualizar(change: Partial<Borrador>) {
    this.borrador.update((draft) => ({ ...draft, ...change }));
    this.quoteId = "";
    this.coordinacionEnviada = false;
    this.mensaje = "";
    this.recalcular();
  }

  recalcular() {
    if (!this.catalogo() || this.preferencias.invalid) return;
    this.error = "";
    this.revisando = true;
    this.analisis.set(undefined);
    this.persistir();
    this.solicitudes.next(this.borrador());
  }

  private persistir() {
    if (!this.catalogo()) return;
    try {
      sessionStorage.setItem(
        CLAVE_BORRADOR,
        JSON.stringify({
          version: this.catalogo()!.version,
          draft: this.borrador(),
          step: this.paso(),
          maxStep: this.maxPaso,
          start: this.inicio,
          consult: this.consultar,
          contact: this.coordinacion.getRawValue(),
        }),
      );
    } catch {
      /* El cotizador sigue disponible si el navegador bloquea almacenamiento. */
    }
  }

  private recuperar() {
    try {
      const saved = JSON.parse(
        sessionStorage.getItem(CLAVE_BORRADOR) || "null",
      );
      if (
        !saved ||
        (saved.version !== this.catalogo()!.version &&
          !["ep2-reference-1", "ep2-reference-2"].includes(saved.version))
      )
        return;
      const source = saved.draft;
      if (
        !source ||
        !Number.isInteger(source.budget) ||
        source.budget < 1 ||
        source.budget > 100000000 ||
        !USOS.includes(source.intendedUse)
      )
        return;
      const draft: Borrador = {
        name:
          typeof source.name === "string" ? source.name.slice(0, 80) : "Mi PC",
        budget: source.budget,
        intendedUse: source.intendedUse,
        drives: [],
        extras: [],
      };
      for (const category of UNICAS) {
        if (this.producto(source[category])?.category === category)
          draft[category] = source[category];
      }
      for (const field of ["memory", "drives", "extras"] as const) {
        const seen = new Set<string>();
        if (!Array.isArray(source[field])) continue;
        draft[field] = source[field].slice(0, 8).filter((item: Cantidad) => {
          if (
            !item ||
            seen.has(item.id) ||
            !Number.isInteger(item.quantity) ||
            item.quantity < 1 ||
            item.quantity > 8
          )
            return false;
          const category = this.producto(item.id)?.category;
          if (
            field === "memory"
              ? category !== "ram"
              : field === "drives"
                ? category !== "storage"
                : category !== "fan" && category !== "support"
          )
            return false;
          seen.add(item.id);
          return true;
        });
      }
      if (draft.ram && !draft.memory?.length)
        draft.memory = [{ id: draft.ram, quantity: 1 }];
      draft.ram = undefined;
      this.borrador.set(draft);
      this.nombreCotizacion.setValue(draft.name || "Mi PC", {
        emitEvent: false,
      });
      this.consultar = saved.consult === true;
      if (saved.contact && typeof saved.contact === "object") {
        const contact = saved.contact;
        const safe = (key: string, max: number) =>
          typeof contact[key] === "string" ? contact[key].slice(0, max) : "";
        this.coordinacion.setValue(
          {
            contactPhone: safe("contactPhone", 30),
            preferredDate: safe("preferredDate", 32),
            serviceAddress: safe("serviceAddress", 240),
            customerNote: safe("customerNote", 600),
          },
          { emitEvent: false },
        );
      }
      this.preferencias.patchValue(
        { budget: draft.budget, intendedUse: draft.intendedUse },
        { emitEvent: false },
      );
      this.paso.set(
        Number.isInteger(saved.step)
          ? Math.min(11, Math.max(1, saved.step))
          : 1,
      );
      this.maxPaso = Math.max(
        Math.min(10, this.paso()),
        Number.isInteger(saved.maxStep)
          ? Math.min(10, Math.max(1, saved.maxStep))
          : 1,
      );
      if (["personalizado", "presupuesto"].includes(saved.start))
        this.inicio = "personalizado";
      this.borradorRecuperado = true;
    } catch {
      /* Un borrador inválido no impide empezar un armado nuevo. */
    }
  }

  motivo(product: Producto): string {
    const draft = this.borrador();
    const cpu = this.producto(draft.cpu);
    const board = this.producto(draft.board);
    const gpu = this.producto(draft.gpu);
    const cooler = this.producto(draft.cooler);
    const caseProduct = this.producto(draft.case);
    const specs = product.specs;
    if (
      product.category === "gpu" &&
      specs["integrated"] &&
      cpu &&
      !cpu.specs["integrated"]
    )
      return "El procesador necesita una gráfica dedicada.";
    if (
      product.category === "board" &&
      cpu &&
      (specs["socket"] !== cpu.specs["socket"] ||
        !(cpu.specs["ramTypes"] as string[]).includes(String(specs["ram"])))
    )
      return "Socket o memoria no compatibles con el procesador.";
    if (
      product.category === "ram" &&
      board &&
      (specs["ram"] !== board.specs["ram"] ||
        Number(specs["modules"]) > Number(board.specs["ramSlots"]) ||
        Number(specs["capacityGb"]) > Number(board.specs["maxRam"]))
    )
      return "Tipo, capacidad o cantidad de módulos no admitidos por la placa.";
    if (
      product.category === "cooler" &&
      specs["kind"] === "stock" &&
      cpu &&
      !cpu.specs["stockCooler"]
    )
      return "Este procesador no incluye cooler.";
    if (product.category === "case") {
      if (
        board &&
        !(specs["forms"] as string[]).includes(String(board.specs["form"]))
      )
        return "No admite el formato de tu placa.";
      if (
        gpu &&
        Number(gpu.specs["lengthMm"]) > Number(specs["gpuClearanceMm"])
      )
        return "Falta espacio para la gráfica.";
      if (
        cooler &&
        Number(cooler.specs["radiatorMm"]) > 0 &&
        !(specs["radiators"] as number[]).includes(
          Number(cooler.specs["radiatorMm"]),
        )
      )
        return "No admite el radiador elegido.";
      if (
        cooler &&
        !Number(cooler.specs["radiatorMm"]) &&
        Number(cooler.specs["heightMm"]) > Number(specs["coolerClearanceMm"])
      )
        return "La torre del cooler no cabe.";
    }
    if (product.category === "psu") {
      if (Number(specs["watts"]) < (this.analisis()?.recommended_watts ?? 0))
        return "Potencia inferior a la recomendada.";
      if (
        caseProduct &&
        !(caseProduct.specs["psuForms"] as string[]).includes(
          String(specs["form"]),
        )
      )
        return "Formato físico no admitido por el gabinete.";
      if (
        gpu &&
        (Number(gpu.specs["pcie8"]) > Number(specs["pcie8"]) ||
          Number(gpu.specs["twelveV"]) > Number(specs["twelveV"]))
      )
        return "Faltan conectores para la gráfica.";
    }
    return "";
  }

  productos(category: Categoria) {
    const query = this.busqueda.toLocaleLowerCase("es");
    return (this.catalogo()?.products ?? [])
      .filter((product) => {
        if (
          product.category !== category ||
          (product.specs["legacy"] && !this.elegido(product)) ||
          !`${product.name} ${product.description}`
            .toLocaleLowerCase("es")
            .includes(query)
        )
          return false;
        if (
          !this.mostrarIncompatibles &&
          this.motivo(product) &&
          !this.elegido(product)
        )
          return false;
        if (
          category === "cpu" &&
          this.marcaCpu !== "Todas" &&
          product.specs["brand"] !== this.marcaCpu
        )
          return false;
        if (
          category === "gpu" &&
          this.marcaGpu !== "Todas" &&
          product.specs["brand"] !== this.marcaGpu
        )
          return false;
        if (
          category === "ram" &&
          ((this.marcaRam !== "Todas" &&
            product.specs["brand"] !== this.marcaRam) ||
            (this.ramCapacidad &&
              Number(product.specs["capacityGb"]) !==
                Number(this.ramCapacidad)) ||
            (this.ramRgb !== "Todas" &&
              Boolean(product.specs["rgb"]) !== (this.ramRgb === "RGB")))
        )
          return false;
        if (
          category === "storage" &&
          this.marcaDisco !== "Todas" &&
          product.specs["brand"] !== this.marcaDisco
        )
          return false;
        if (
          category === "storage" &&
          (product.specs["kind"] !== this.tipoDisco ||
            (this.capacidadFiltro &&
              Number(product.specs["capacityGb"]) !==
                Number(this.capacidadFiltro)))
        )
          return false;
        if (
          category === "cooler" &&
          this.tipoCooler !== "Todos" &&
          (this.tipoCooler === "air"
            ? !["air", "stock"].includes(String(product.specs["kind"]))
            : product.specs["kind"] !== this.tipoCooler)
        )
          return false;
        if (
          category === "case" &&
          this.formaFiltro !== "Todas" &&
          !(product.specs["forms"] as string[]).includes(this.formaFiltro)
        )
          return false;
        if (
          category === "psu" &&
          ((this.modularidad !== "Todas" &&
            product.specs["modularity"] !== this.modularidad) ||
            (this.potenciaFiltro &&
              Number(product.specs["watts"]) !== Number(this.potenciaFiltro)))
        )
          return false;
        return true;
      })
      .sort((a, b) => a.price - b.price);
  }

  seleccionMultiple(field: "drives" | "extras") {
    return this.borrador()[field].flatMap((item) => {
      const product = this.producto(item.id);
      return product ? [{ ...product, quantity: item.quantity }] : [];
    });
  }

  refrigeraciones(kind: string) {
    return this.productos("cooler").filter((p) => p.specs["kind"] === kind);
  }

  puedeSeguir() {
    if (
      this.preferencias.invalid ||
      this.revisando ||
      !this.analisis() ||
      this.guardando
    )
      return false;
    if (this.paso() === 1) return this.inicio !== "presets";
    const category = this.categoriaPorPaso[this.paso()];
    return (
      !this.analisis()!.missing.includes(category) &&
      !this.analisis()!.issues.some(
        (issue) => issue.severity === "block" && issue.category === category,
      )
    );
  }

  ir(step: number) {
    if (this.guardando) return;
    if (
      step > this.maxPaso &&
      (step !== this.paso() + 1 || !this.puedeSeguir())
    )
      return;
    if (step === 9) {
      const powers = (this.catalogo()?.products ?? [])
        .filter(
          (product) => product.category === "psu" && !this.motivo(product),
        )
        .map((product) => Number(product.specs["watts"]));
      this.potenciaFiltro = powers.length ? Math.min(...powers) : 0;
      this.modularidad = "Todas";
    }
    this.paso.set(Math.min(10, Math.max(1, step)));
    this.maxPaso = Math.max(this.maxPaso, this.paso());
    this.busqueda = "";
    this.mostrarIncompatibles = false;
    this.recalcular();
    this.enfocar();
  }

  private enfocar() {
    document
      .getElementById("cotizador")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  abrirGuardado() {
    if (!this.analisis()?.can_save || this.revisando) return;
    this.paso.set(11);
    if (!this.coordinacion.controls.contactPhone.value)
      this.coordinacion.patchValue({
        contactPhone: this.autenticacion.user?.phone ?? "",
      });
    this.persistir();
    this.enfocar();
  }

  cambiarConsulta(value: boolean) {
    this.consultar = value;
    this.persistir();
  }

  guardar() {
    if (
      !this.analisis()?.can_save ||
      this.preferencias.invalid ||
      this.guardando ||
      this.revisando ||
      this.quoteId
    )
      return;
    if (this.nombreCotizacion.invalid) {
      this.nombreCotizacion.markAsTouched();
      return;
    }
    if (this.consultar && this.coordinacion.invalid) {
      this.coordinacion.markAllAsTouched();
      return;
    }
    if (!this.autenticacion.user) {
      this.recalcular();
      window.location.assign(
        "/login?returnUrl=" + encodeURIComponent("/#cotizador"),
      );
      return;
    }
    this.guardando = true;
    this.error = "";
    this.servicio
      .guardar({ ...this.borrador(), name: this.nombreCotizacion.value.trim() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.guardando = false;
          this.quoteId = result.quoteId ?? "";
          this.analisis.set(result);
          this.mensaje =
            "Cotización guardada con todas tus piezas y cantidades.";
          if (this.consultar) this.solicitarCoordinacion();
        },
        error: (error) => {
          this.guardando = false;
          this.error =
            error?.error?.message ||
            "No pudimos guardar. Puedes volver a intentarlo.";
        },
      });
  }

  solicitarCoordinacion() {
    if (
      this.coordinacion.invalid ||
      !this.quoteId ||
      this.enviando ||
      this.coordinacionEnviada
    ) {
      this.coordinacion.markAllAsTouched();
      return;
    }
    this.enviando = true;
    const data = this.coordinacion.getRawValue();
    this.cotizaciones
      .requestCoordination(this.quoteId, {
        ...data,
        preferredDate: data.preferredDate || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.enviando = false;
          this.coordinacionEnviada = true;
          this.mensaje =
            "Solicitud enviada. Puedes seguir su estado en Mis consultas.";
        },
        error: () => {
          this.enviando = false;
          this.error = "No pudimos enviar la solicitud. Vuelve a intentarlo.";
        },
      });
  }

  dinero(value: number) {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(value);
  }

  editarCategoria(category: Categoria) {
    const entry = Object.entries(this.categoriaPorPaso).find(
      ([, value]) => value === category,
    );
    this.ir(
      category === "fan" || category === "support"
        ? 7
        : Number(entry?.[0] ?? 1),
    );
  }
}
