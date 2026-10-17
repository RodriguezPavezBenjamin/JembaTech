import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, EventEmitter, Output, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, catchError, map, of, switchMap, timer } from 'rxjs';
import { Analisis, Borrador, Categoria, Producto } from '../../modelos/catalogo';
import { Cotizacion, dinero } from '../../modelos/cotizacion';
import { CatalogoService } from '../../servicios/catalogo.service';

export interface FilaEdicion { key: number; category: Categoria; id: string; quantity: number; }
export const GRUPOS_EDICION: Array<{ category: Categoria; label: string; multiple?: boolean }> = [
  { category: 'cpu', label: 'Procesador' }, { category: 'gpu', label: 'Gráfica' },
  { category: 'board', label: 'Placa madre' }, { category: 'ram', label: 'Memoria RAM', multiple: true },
  { category: 'storage', label: 'Almacenamiento', multiple: true }, { category: 'cooler', label: 'Refrigeración' },
  { category: 'fan', label: 'Ventiladores', multiple: true }, { category: 'support', label: 'Soporte GPU', multiple: true },
  { category: 'case', label: 'Gabinete' }, { category: 'psu', label: 'Fuente' },
];

export function borradorDesdeFilas(quote: Cotizacion, filas: FilaEdicion[], name: string, budget: number): Borrador {
  const draft: Borrador = { name: name.trim(), budget, intendedUse: quote.intendedUse, memory: [], drives: [], extras: [] };
  for (const fila of filas) {
    if (!fila.id) continue;
    const item = { id: fila.id, quantity: fila.quantity };
    switch (fila.category) {
      case 'ram': draft.memory!.push(item); break;
      case 'storage': draft.drives.push(item); break;
      case 'fan': case 'support': draft.extras.push(item); break;
      default: draft[fila.category] = fila.id;
    }
  }
  return draft;
}

@Component({
  selector: 'app-editor-cotizacion', standalone: true, imports: [CommonModule, FormsModule],
  templateUrl: './editor-cotizacion.component.html', styleUrl: './editor-cotizacion.component.scss',
})
export class EditorCotizacionComponent {
  private readonly servicio = inject(CatalogoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly revisiones = new Subject<Borrador | null>();
  @ViewChild('dialogo', { static: true }) dialogo!: ElementRef<HTMLDialogElement>;
  @Output() guardado = new EventEmitter<string>();
  grupos = GRUPOS_EDICION;
  quote?: Cotizacion;
  filas: FilaEdicion[] = [];
  catalogo: Producto[] = [];
  fallidas = new Set<string>();
  nombre = '';
  presupuesto = 0;
  cargando = false;
  revisando = false;
  guardando = false;
  analisis?: Analisis;
  error = '';
  errorRevision = '';
  private siguienteKey = 0;
  dinero = dinero;
  get copia() { return this.quote?.status !== 'DRAFT' || !!this.quote?.requestDeletedAt; }
  get total() { return this.filas.reduce((sum, fila) => sum + (this.producto(fila.id)?.price ?? 0) * (Number(fila.quantity) || 0), 0); }
  get valido() {
    return !!this.nombre.trim() && this.nombre.length <= 80 && Number.isInteger(this.presupuesto) && this.presupuesto > 0 && this.presupuesto <= 100000000 &&
      this.filas.every(f => !!this.producto(f.id) && Number.isInteger(f.quantity) && f.quantity >= 1 && f.quantity <= (f.category === 'support' ? 1 : 8)) &&
      new Set(this.filas.map(f => f.id)).size === this.filas.length &&
      this.filas.filter(f => f.category === 'ram').length <= 8 && this.filas.filter(f => f.category === 'storage').length <= 8 && this.filas.filter(f => ['fan', 'support'].includes(f.category)).length <= 8;
  }

  constructor() {
    this.revisiones.pipe(
      switchMap(draft => draft ? timer(250).pipe(
        switchMap(() => this.servicio.revisar(draft)),
        map(analisis => ({ analisis, error: '' })),
        catchError(() => of({ analisis: undefined, error: 'No se pudo revisar la compatibilidad. Reintenta antes de guardar.' })),
      ) : of({ analisis: undefined, error: '' })),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(result => {
      this.analisis = result.analisis;
      this.errorRevision = result.error;
      this.revisando = false;
    });
  }
  abrir(quote: Cotizacion) {
    if (!quote.configuration?.components?.length || this.dialogo.nativeElement.open) return;
    this.quote = quote;
    this.nombre = this.copia ? `${quote.name || 'Mi cotización'} · copia`.slice(0, 80) : quote.name || 'Mi cotización';
    this.presupuesto = quote.budget;
    this.error = '';
    this.errorRevision = '';
    this.analisis = undefined;
    this.catalogo = [];
    this.fallidas.clear();
    this.filas = quote.configuration.components.map(p => ({ key: ++this.siguienteKey, category: p.category, id: p.id, quantity: p.quantity }));
    for (const grupo of this.grupos.filter(g => !g.multiple)) {
      if (!this.filas.some(f => f.category === grupo.category)) this.filas.push({ key: ++this.siguienteKey, category: grupo.category, id: '', quantity: 1 });
    }
    this.dialogo.nativeElement.showModal();
    this.cargar();
  }
  cargar() {
    this.cargando = true;
    this.error = '';
    const quoteId = this.quote?.id;
    this.servicio.cargar().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        if (this.quote?.id !== quoteId || !this.dialogo.nativeElement.open) return;
        this.catalogo = result.products;
        this.cargando = false;
        this.cambio();
      },
      error: () => { if (this.quote?.id === quoteId) { this.cargando = false; this.error = 'No se pudo cargar el catálogo. La cotización original no cambió.'; } },
    });
  }
  producto(id: string) { return this.catalogo.find(p => p.id === id); }
  etiqueta(category: string) {
    const aliases: Record<string, string> = { memory: 'ram', drives: 'storage' };
    return this.grupos.find(g => g.category === (aliases[category] || category))?.label || category;
  }
  porGrupo(category: Categoria) { return this.filas.filter(f => f.category === category); }
  opciones(category: Categoria) {
    return this.catalogo.filter(p => p.category === category && (!p.specs['legacy'] || this.filas.some(f => f.id === p.id)));
  }
  repetido(id: string, key: number) { return this.filas.some(f => f.key !== key && f.id === id); }
  puedeAgregar(category: Categoria) {
    const cantidad = category === 'fan' || category === 'support' ? this.filas.filter(f => ['fan', 'support'].includes(f.category)).length : this.porGrupo(category).length;
    return cantidad < 8 && this.opciones(category).some(p => !this.filas.some(f => f.id === p.id));
  }
  agregar(category: Categoria) {
    if (this.guardando || !this.puedeAgregar(category)) return;
    const producto = this.opciones(category).find(p => !this.filas.some(f => f.id === p.id));
    this.filas.push({ key: ++this.siguienteKey, category, id: producto!.id, quantity: 1 });
    this.cambio();
  }
  quitar(fila: FilaEdicion) {
    if (this.guardando || !this.grupos.find(g => g.category === fila.category)?.multiple) return;
    this.filas = this.filas.filter(f => f.key !== fila.key);
    this.cambio();
  }
  cambio() {
    if (this.guardando || !this.quote) return;
    this.error = '';
    this.analisis = undefined;
    this.revisando = this.valido;
    this.revisiones.next(this.valido ? borradorDesdeFilas(this.quote, this.filas, this.nombre, this.presupuesto) : null);
  }
  guardar() {
    if (!this.quote || !this.valido || !this.analisis?.can_save || this.revisando || this.guardando) return;
    const draft = borradorDesdeFilas(this.quote, this.filas, this.nombre, this.presupuesto);
    this.guardando = true;
    this.error = '';
    const copia = this.copia;
    const operacion = copia ? this.servicio.guardar(draft) : this.servicio.actualizar(this.quote.id, draft, this.quote.updatedAt);
    operacion.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.guardando = false;
        this.cerrar();
        this.guardado.emit(copia ? 'Copia guardada. La cotización y consulta anteriores no cambiaron.' : 'Componentes y evaluación actualizados.');
      },
      error: error => {
        this.guardando = false;
        this.error = error.status === 409 ? 'La cotización cambió o recibió una consulta mientras editabas. Cierra y recarga el historial; tus cambios no se guardaron.' : 'No se pudieron guardar los cambios. La versión original no cambió; revisa las piezas y vuelve a intentar.';
      },
    });
  }
  cerrar() {
    if (this.guardando) return;
    this.revisiones.next(null);
    this.dialogo.nativeElement.close();
  }
  cancelarEvento(event: Event) { event.preventDefault(); this.cerrar(); }
  cerrarFondo(event: Event) { if (event.target === this.dialogo.nativeElement) this.cerrar(); }
}
