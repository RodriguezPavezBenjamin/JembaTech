import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription, forkJoin, interval } from 'rxjs';
import { FuentesService } from '../../servicios/fuentes.service';
import { CatalogImportOverview } from '../../modelos/fuente';
import { ExternalReference, PriceTarget, ReferencePage, SourceCategory, SourceOverview, SourceRun, SourceTarget } from '../../modelos/fuente';

@Component({
  selector: 'app-fuentes', standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './fuentes.component.html',
  styleUrls: ['../../estilos/paginas.scss', './fuentes.component.scss'],
})
export class FuentesComponent implements OnInit, OnDestroy {
  private readonly fuentes = inject(FuentesService);
  private consulta?: Subscription;
  private guardado?: Subscription;
  private reloj?: Subscription;
  ahora = Date.now();
  categoriaConsulta: SourceCategory = 'cpu';
  readonly categorias: { id: SourceCategory; label: string }[] = [
    { id: 'cpu', label: 'Procesadores' }, { id: 'gpu', label: 'Gráficas' },
    { id: 'motherboard', label: 'Placas madre' }, { id: 'ram', label: 'Memoria RAM' },
    { id: 'storage', label: 'Almacenamiento' },
  ];
  objetivoConsulta = 'ryzen-7600';
  objetivos: SourceTarget[] = [];
  precios: PriceTarget[] = [];
  catalogo?: CatalogImportOverview;
  readonly etiquetasCatalogo: Record<string, string> = { cpu: 'Procesadores', gpu: 'Gráficas', ram: 'RAM', board: 'Placas madre', case: 'Gabinetes' };
  objetivoCatalogo = 'cpu-intel-11';
  catalogoConfirmado = false;
  get puedeImportarCatalogo() { return !!this.resumen?.manualProbeEnabled && !this.resumen.probeRunning && !this.guardando && !this.cargando && !this.segundosRestantes && this.catalogoConfirmado && this.catalogo?.targets.some(t => t.id === this.objetivoCatalogo); }
  importarCatalogo() {
    if (!this.puedeImportarCatalogo) return;
    this.guardando = true; this.errorConsulta = ''; this.mensaje = '';
    this.guardado = this.fuentes.importarCatalogo(this.objetivoCatalogo).subscribe({
      next: result => { this.guardando = false; this.catalogoConfirmado = false; this.mensaje = `${result.imported} modelos importados de ${result.received} fichas: foto, precio y procedencia. Las cotizaciones guardadas no cambiaron. Si no hubo ofertas aptas, no se inventaron precios.`; this.ahora = Date.now(); this.cargar(); },
      error: () => { this.guardando = false; this.errorConsulta = 'No se pudo importar. Revisa espera, acceso e historial: no se reintentará automáticamente ni se reemplazará el catálogo anterior.'; this.ahora = Date.now(); this.cargar(); },
    });
  }
  objetivoPrecio = 'cpu-7600';
  precioConfirmado = false;
  get puedeConsultarPrecio() { return !!this.resumen?.manualProbeEnabled && !this.resumen.probeRunning && !this.guardando && !this.cargando && !this.segundosRestantes && this.precioConfirmado && this.precios.some(p => p.id === this.objetivoPrecio); }
  get precioSeleccionado() { return this.precios.find(p => p.id === this.objetivoPrecio)?.priceInfo; }
  get precioVencido() { const precio = this.precioSeleccionado; return !!precio && Date.parse(precio.expiresAt) <= this.ahora; }
  dinero(value: number) { return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value); }
  categoriaFiltro: SourceCategory | '' = '';
  marcaFiltro = '';
  consultaConfirmada = false;
  errorConsulta = '';
  resumen?: SourceOverview;
  referencias: ReferencePage = { items: [], total: 0, page: 1, pageSize: 12 };
  ejecuciones: SourceRun[] = [];
  busqueda = '';
  muestra = '';
  cargando = false;
  guardando = false;
  error = '';
  errorMuestra = '';
  mensaje = '';
  get paginas() { return Math.max(1, Math.ceil(this.referencias.total / this.referencias.pageSize)); }
  get validezUltimoLote() {
    const metrics = this.resumen?.latestRun?.metrics;
    const value = metrics?.validPercent;
    return metrics && metrics.received > 0 && typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? `${value}%` : 'Sin datos';
  }
  get segundosRestantes() { return Math.max(0, Math.ceil(((Date.parse(this.resumen?.nextAllowedAt ?? '') || 0) - this.ahora) / 1000)); }
  get origenLote() { return this.resumen?.latestRun?.mode === 'manual-api' ? 'Consulta API' : this.resumen?.latestRun ? 'Muestra manual' : 'Sin ejecuciones'; }
  get objetivosDisponibles() { return this.objetivos.filter(target => target.category === this.categoriaConsulta); }
  get puedeConsultar() { return !!this.resumen?.manualProbeEnabled && !this.resumen.probeRunning && !this.guardando && !this.cargando && !this.segundosRestantes && this.consultaConfirmada && this.objetivosDisponibles.some(target => target.id === this.objetivoConsulta); }
  cambiarCategoriaConsulta() { this.objetivoConsulta = this.objetivosDisponibles[0]?.id ?? ''; this.consultaConfirmada = false; }
  ngOnInit() { this.reloj = interval(1000).subscribe(() => this.ahora = Date.now()); this.cargar(); }
  ngOnDestroy() { this.consulta?.unsubscribe(); this.guardado?.unsubscribe(); this.reloj?.unsubscribe(); }

  cargar(page = 1) {
    this.consulta?.unsubscribe();
    this.cargando = true;
    this.error = '';
    this.consulta = forkJoin({ resumen: this.fuentes.resumen(), referencias: this.fuentes.referencias(this.busqueda.trim(), page, this.categoriaFiltro, this.marcaFiltro), ejecuciones: this.fuentes.ejecuciones(), objetivos: this.fuentes.objetivos(), precios: this.fuentes.precios(), catalogo: this.fuentes.catalogo() }).subscribe({
      next: data => { this.resumen = data.resumen; this.referencias = data.referencias; this.ejecuciones = data.ejecuciones; this.objetivos = data.objetivos; this.precios = data.precios; this.catalogo = data.catalogo; this.cargando = false; },
      error: () => { this.cargando = false; this.error = 'No pudimos consultar las referencias. Los últimos datos visibles pueden estar desactualizados; vuelve a intentar.'; },
    });
  }

  preparar() {
    if (this.guardando) return;
    this.errorMuestra = '';
    this.mensaje = '';
    let payload: { retrievedAt: string; records: unknown[]; category?: SourceCategory };
    try {
      if (this.muestra.length > 100000) throw new Error();
      const value: unknown = JSON.parse(this.muestra);
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
      const row = value as Record<string, unknown>;
      if (typeof row['retrievedAt'] !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(row['retrievedAt']) || !Number.isFinite(Date.parse(row['retrievedAt'])) || Date.parse(row['retrievedAt']) > Date.now() + 300000 || !Array.isArray(row['records']) || row['records'].length < 1 || row['records'].length > 5) throw new Error();
      if (row['category'] !== undefined && !this.categorias.some(category => category.id === row['category'])) throw new Error();
      payload = { retrievedAt: row['retrievedAt'], records: row['records'], ...(row['category'] ? { category: row['category'] as SourceCategory } : {}) };
    } catch {
      this.errorMuestra = 'Revisa el JSON: category debe ser cpu, gpu, motherboard, ram o storage; retrievedAt una fecha con zona horaria, no futura; records de 1 a 5 fichas. Máximo 100 KB.';
      return;
    }
    this.guardando = true;
    this.guardado = this.fuentes.preparar(payload).subscribe({
      next: run => {
        this.guardando = false;
        this.muestra = '';
        this.mensaje = `Muestra procesada: ${run.metrics?.accepted ?? 0} válidas, ${run.metrics?.rejected ?? 0} rechazadas y ${run.metrics?.duplicates ?? 0} repetidas. ${run.storedCount} fichas guardadas; ${run.staleSkipped} omitidas por antigüedad/conflicto.`;
        this.cargar();
      },
      error: () => { this.guardando = false; this.errorMuestra = 'No se pudo preparar la muestra. Conservamos tu JSON para reintentar; revisa el historial de ejecuciones.'; this.cargar(this.referencias.page); },
    });
  }

  consultarFuente() {
    if (!this.puedeConsultar) return;
    this.guardando = true;
    this.errorConsulta = '';
    this.mensaje = '';
    this.guardado = this.fuentes.recuperar(this.objetivoConsulta).subscribe({
      next: run => {
        this.guardando = false;
        this.consultaConfirmada = false;
        this.mensaje = `Consulta API completada: ${run.metrics?.received ?? 0} fichas recibidas, ${run.metrics?.accepted ?? 0} válidas y ${run.storedCount} guardadas. El cotizador no se modificó.`;
        if (!run.metrics?.accepted) {
          this.mensaje = '';
          this.errorConsulta = run.metrics?.received
            ? 'SoloTodo respondió, pero ninguna candidata superó la validación. Revisa las incidencias del historial; las fichas anteriores siguen intactas.'
            : 'La página consultada no trajo candidatas. No se consultarán otras páginas automáticamente; las fichas anteriores siguen intactas.';
        }
        this.ahora = Date.now();
        this.cargar();
      },
      error: (error: { error?: { code?: string; runId?: string } }) => {
        this.guardando = false;
        const mensajes: Record<string, string> = {
          SOURCE_COOLDOWN: 'Espera un minuto entre consultas a la fuente.',
          SOURCE_RATE_LIMITED: 'SoloTodo limitó las consultas. No reintentaremos automáticamente.',
          SOURCE_ACCESS_DENIED: 'La fuente denegó el acceso. No intentaremos eludir la restricción.',
          MANUAL_PROBE_DISABLED: 'La consulta puntual está desactivada en este ambiente.',
          SOURCE_UNAVAILABLE: 'SoloTodo no está disponible en este momento.',
          PYTHON_UNAVAILABLE: 'El servicio de recuperación no está disponible en este momento.',
        };
        this.errorConsulta = (mensajes[error.error?.code ?? ''] ?? 'No se pudo recuperar una respuesta válida de la fuente.') + ' Tus fichas anteriores siguen intactas.';
        this.ahora = Date.now();
        this.cargar();
      },
    });
  }

  consultarPrecio() {
    if (!this.puedeConsultarPrecio) return;
    this.guardando = true; this.errorConsulta = ''; this.mensaje = '';
    this.guardado = this.fuentes.recuperarPrecio(this.objetivoPrecio).subscribe({
      next: result => {
        this.guardando = false; this.precioConfirmado = false;
        this.mensaje = result.applied && result.priceInfo
          ? `Precio normal consultado: ${this.dinero(result.priceInfo.normalPriceClp)} · ${result.priceInfo.storeHost}. Aplicado a nuevas revisiones del cotizador; las cotizaciones guardadas no cambiaron.`
          : 'No hubo ofertas aptas y recientes en esta página. El componente conserva una estimación manual, identificada como tal.';
        this.ahora = Date.now(); this.cargar();
      },
      error: () => { this.guardando = false; this.errorConsulta = 'No pudimos actualizar el precio. Revisa la espera y el historial; no se reintentará automáticamente ni se modificarán tus cotizaciones.'; this.ahora = Date.now(); this.cargar(); },
    });
  }

  origenSeguro(item: ExternalReference) {
    return /^[1-9]\d*$/.test(item.externalId) && item.sourceUrl === `https://www.solotodo.cl/products/${item.externalId}` ? item.sourceUrl : null;
  }
  antiguedad(item: ExternalReference) {
    if (!item.sourceUpdatedAt) return 'Actualización desconocida';
    const age = Math.floor((this.ahora - Date.parse(item.sourceUpdatedAt)) / 86400000);
    if (!Number.isFinite(age)) return 'Actualización desconocida';
    return age > 90 ? `Revisar vigencia · ${age} días sin actualización de origen` : 'La fecha no garantiza vigencia ni stock';
  }
  faltantes(item: ExternalReference) {
    const fields = [];
    if (!item.partNumber) fields.push('Part Number');
    if (this.aplicaTdp(item.category) && item.specs.declaredTdpWatts == null) fields.push('TDP');
    if (item.category === 'gpu') {
      if (item.specs.lengthMm == null) fields.push('largo');
      if (item.specs.slots == null) fields.push('slots');
      if (!item.specs.bus) fields.push('interfaz');
    }
    if (item.category === 'motherboard') {
      if (item.specs.m2Slots == null) fields.push('slots M.2');
      if (item.specs.sataPorts == null) fields.push('puertos SATA');
    }
    if (item.category === 'ram' && item.specs.casLatency == null) fields.push('latencia CL');
    if (item.category === 'storage') {
      if (item.specs.storageType === 'HDD' && item.specs.rpm == null) fields.push('RPM');
      if (item.specs.storageType === 'SSD') {
        if (item.specs.readMbps == null) fields.push('lectura');
        if (item.specs.writeMbps == null) fields.push('escritura');
        if (!item.specs.connector) fields.push('conector');
        if (item.specs.interface === 'PCIe' && !item.specs.protocol) fields.push('protocolo NVMe por confirmar');
      }
    }
    return fields.length ? `Sin dato: ${fields.join(', ')}` : 'Campos del contrato completos · no equivale a exactitud verificada';
  }
  aplicaTdp(category?: SourceCategory) { return !category || category === 'cpu' || category === 'gpu'; }
  nombreCategoria(category: SourceCategory) { return this.categorias.find(item => item.id === category)?.label ?? category; }
  incidencia(code: string) { return ({ target_mismatch: 'No coincide con la búsqueda', invalid_record: 'Ficha inválida', duplicate_id: 'ID repetido', conflicting_duplicate: 'ID repetido con datos distintos' } as Record<string, string>)[code] ?? code; }
  estado(status: string) { return ({ SUCCEEDED: 'Procesada', FAILED: 'Fallida', RUNNING: 'En proceso' } as Record<string, string>)[status] ?? 'Desconocido'; }
}
