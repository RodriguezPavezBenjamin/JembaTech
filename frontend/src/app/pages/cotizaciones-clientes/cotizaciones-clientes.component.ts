import { CommonModule } from "@angular/common";
import { Component, OnInit, ViewChild, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { QuoteService, AdminCoordination } from "../../servicios/cotizaciones.service";
import { DetalleArmadoComponent } from "../../compartidos/detalle-armado/detalle-armado.component";
import { ConfirmarAccionComponent } from "../../compartidos/confirmar-accion/confirmar-accion.component";
import { ResumenCotizacionComponent } from "../../compartidos/resumen-cotizacion/resumen-cotizacion.component";
import { Cotizacion, ESTADOS, dinero, estadoCotizacion, fechaLocal } from "../../modelos/cotizacion";

@Component({
  selector: "app-cotizaciones-clientes", standalone: true,
  imports: [CommonModule, FormsModule, DetalleArmadoComponent, ConfirmarAccionComponent, ResumenCotizacionComponent],
  templateUrl: "./cotizaciones-clientes.component.html",
  styleUrl: "../../estilos/paginas.scss",
})
export class CotizacionesClientesComponent implements OnInit {
  private readonly servicio = inject(QuoteService);
  @ViewChild(ConfirmarAccionComponent) confirmacion!: ConfirmarAccionComponent;
  cotizaciones: Cotizacion[] = [];
  seleccionada?: Cotizacion;
  pendiente?: Cotizacion;
  accion: 'cotizacion' | 'consulta' = 'cotizacion';
  cargando = true;
  guardandoId = "";
  eliminando = false;
  mensaje = "";
  error = "";
  errorEliminar = "";
  busqueda = "";
  filtro = "";
  edicion = { status: 'REQUESTED' as AdminCoordination['status'], adminNote: '', preferredDate: '' };
  estados = Object.entries(ESTADOS);
  dinero = dinero;
  estado = estadoCotizacion;

  get filtradas() {
    const search = this.busqueda.trim().toLocaleLowerCase('es');
    return this.cotizaciones.filter(q => {
      const matches = !search || [q.id, q.name, q.user?.name, q.user?.email, q.contactPhone, q.user?.phone].some(value => value?.toLocaleLowerCase('es').includes(search));
      const state = this.filtro === 'RETIRED' ? !!q.requestDeletedAt : !this.filtro || (!q.requestDeletedAt && q.status === this.filtro);
      return matches && state;
    });
  }
  get detalle() { return this.filtradas.find(q => q.id === this.seleccionada?.id); }
  contar(estado: string) { return this.cotizaciones.filter(q => !q.requestDeletedAt && q.status === estado).length; }
  ngOnInit() { this.recargar(); }
  recargar() {
    this.cargando = true;
    this.error = "";
    this.servicio.list('all').subscribe({
      next: datos => {
        this.cotizaciones = datos;
        this.cargando = false;
        const selected = this.filtradas.find(q => q.id === this.seleccionada?.id) || this.filtradas[0];
        this.seleccionada = undefined;
        if (selected) this.seleccionar(selected);
      },
      error: () => { this.cargando = false; this.error = "No se pudieron cargar las cotizaciones. Vuelve a intentar."; },
    });
  }
  aplicarFiltro() {
    const selected = this.filtradas.find(q => q.id === this.seleccionada?.id) || this.filtradas[0];
    if (selected?.id !== this.seleccionada?.id) {
      this.seleccionada = undefined;
      if (selected) this.seleccionar(selected);
    }
  }
  seleccionar(quote: Cotizacion) {
    if (this.guardandoId || this.eliminando) return;
    this.seleccionada = quote;
    this.edicion = { status: quote.status, adminNote: quote.adminNote || '', preferredDate: fechaLocal(quote.preferredDate) };
  }
  guardar() {
    const quote = this.detalle;
    if (!quote || quote.requestDeletedAt || this.guardandoId) return;
    const date = this.edicion.preferredDate ? new Date(this.edicion.preferredDate) : null;
    if (date && Number.isNaN(date.getTime())) { this.error = 'Revisa la fecha de coordinación.'; return; }
    this.guardandoId = quote.id;
    this.mensaje = "";
    this.error = "";
    this.servicio.coordinate(quote.id, { ...this.edicion, preferredDate: date?.toISOString() ?? null }).subscribe({
      next: updated => {
        this.cotizaciones = this.cotizaciones.map(q => q.id === updated.id ? updated : q);
        this.guardandoId = "";
        this.seleccionar(updated);
        this.aplicarFiltro();
        this.mensaje = "Estado, fecha y respuesta actualizados.";
      },
      error: () => { this.guardandoId = ""; this.error = "No se pudo guardar. La consulta puede haber sido retirada; recarga para comprobarlo. Tus cambios siguen en el formulario."; },
    });
  }
  telefono(quote: Cotizacion) { return (quote.contactPhone || quote.user?.phone || '').replace(/\D/g, ''); }
  whatsapp(quote: Cotizacion) {
    return 'https://wa.me/' + this.telefono(quote) + '?text=' + encodeURIComponent('Hola ' + (quote.user?.name || '') + ', revisé tu cotización JembaTech «' + (quote.name || quote.id) + '».');
  }
  pedirEliminar(quote: Cotizacion, accion: 'cotizacion' | 'consulta') {
    this.pendiente = quote;
    this.accion = accion;
    this.errorEliminar = '';
    this.confirmacion.abrir();
  }
  eliminar() {
    if (!this.pendiente || this.eliminando) return;
    const id = this.pendiente.id;
    this.eliminando = true;
    this.errorEliminar = '';
    const operation = this.accion === 'cotizacion' ? this.servicio.remove(id) : this.servicio.removeRequest(id);
    operation.subscribe({
      next: () => {
        this.cotizaciones = this.accion === 'cotizacion'
          ? this.cotizaciones.filter(q => q.id !== id)
          : this.cotizaciones.map(q => q.id === id ? { ...q, requestDeletedAt: new Date().toISOString(), status: 'EXPIRED' } : q);
        this.eliminando = false;
        this.confirmacion.ocupado = false;
        this.confirmacion.cerrar();
        this.seleccionada = undefined;
        this.aplicarFiltro();
        this.mensaje = this.accion === 'cotizacion' ? 'Cotización eliminada del historial del cliente y del panel.' : 'Consulta retirada; el armado del cliente se conserva.';
      },
      error: () => { this.eliminando = false; this.errorEliminar = 'No se pudo completar la acción. No hemos quitado el registro; vuelve a intentar.'; },
    });
  }
}
