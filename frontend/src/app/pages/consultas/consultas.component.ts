import { CommonModule } from "@angular/common";
import { Component, OnInit, ViewChild, inject } from "@angular/core";
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { QuoteService } from "../../servicios/cotizaciones.service";
import { AuthService } from '../../servicios/autenticacion.service';
import { Cotizacion, dinero, estadoCotizacion, fechaLocal } from '../../modelos/cotizacion';
import { ConfirmarAccionComponent } from '../../compartidos/confirmar-accion/confirmar-accion.component';
import { DetalleArmadoComponent } from '../../compartidos/detalle-armado/detalle-armado.component';
@Component({
  selector: "app-consultas",
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmarAccionComponent, DetalleArmadoComponent],
  templateUrl: "./consultas.component.html",
  styleUrl: "../../estilos/paginas.scss",
})
export class ConsultasComponent implements OnInit {
  private readonly servicio = inject(QuoteService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  @ViewChild(ConfirmarAccionComponent) confirmacion!: ConfirmarAccionComponent;
  todas: Cotizacion[] = [];
  cargando = true;
  error = '';
  mensaje = '';
  errorEliminar = '';
  errorSolicitud = '';
  eliminando = false;
  enviando = false;
  pendiente?: Cotizacion;
  nueva = false;
  seleccionId = '';
  datos = { contactPhone: '', serviceAddress: '', preferredDate: '', customerNote: '' };
  dinero = dinero;
  estado = estadoCotizacion;
  get cotizaciones() {
    const id = this.ruta.snapshot.queryParamMap.get('cotizacion');
    return this.todas.filter(item => item.status !== 'DRAFT' && !item.requestDeletedAt).sort((a, b) => Number(b.id === id) - Number(a.id === id));
  }
  get disponibles() { return this.todas.filter(item => item.status === 'DRAFT' || !!item.requestDeletedAt); }
  ngOnInit() {
    this.recargar();
  }
  recargar() {
    this.cargando = true;
    this.error = '';
    this.servicio.list().subscribe({
      next: (datos) => {
        this.todas = datos;
        this.cargando = false;
        const id = this.ruta.snapshot.queryParamMap.get('cotizacion');
        if (id && this.disponibles.some(item => item.id === id)) {
          this.nueva = true;
          this.seleccionId = id;
          this.preparar();
        }
      },
      error: () => { this.cargando = false; this.error = 'No se pudieron cargar las consultas. Intenta nuevamente.'; },
    });
  }
  abrirSolicitud() {
    this.nueva = true;
    this.seleccionId = this.disponibles[0]?.id ?? '';
    this.preparar();
  }
  preparar() {
    const quote = this.disponibles.find(item => item.id === this.seleccionId);
    this.errorSolicitud = '';
    this.datos = {
      contactPhone: quote?.contactPhone || this.auth.user?.phone || '',
      serviceAddress: quote?.serviceAddress || '',
      preferredDate: fechaLocal(quote?.preferredDate), customerNote: quote?.customerNote || '',
    };
  }
  enviar() {
    if (this.enviando || !this.disponibles.some(item => item.id === this.seleccionId)) return;
    if (this.datos.contactPhone.trim().length < 8) { this.errorSolicitud = 'Escribe un teléfono de contacto válido.'; return; }
    const fecha = this.datos.preferredDate ? new Date(this.datos.preferredDate) : undefined;
    if (fecha && Number.isNaN(fecha.getTime())) { this.errorSolicitud = 'Revisa la fecha ingresada.'; return; }
    this.enviando = true;
    this.errorSolicitud = '';
    this.servicio.requestCoordination(this.seleccionId, { ...this.datos, preferredDate: fecha?.toISOString() }).subscribe({
      next: quote => {
        this.todas = this.todas.map(item => item.id === quote.id ? quote : item);
        this.enviando = false;
        this.nueva = false;
        this.mensaje = 'Consulta enviada. Puedes revisar su estado aquí.';
      },
      error: () => { this.enviando = false; this.errorSolicitud = 'No se pudo enviar la consulta. Conservamos lo que escribiste.'; },
    });
  }
  pedirEliminar(quote: Cotizacion) {
    this.pendiente = quote;
    this.errorEliminar = '';
    this.confirmacion.abrir();
  }
  eliminar() {
    if (!this.pendiente || this.eliminando) return;
    const id = this.pendiente.id;
    this.eliminando = true;
    this.errorEliminar = '';
    this.servicio.removeRequest(id).subscribe({
      next: () => {
        this.todas = this.todas.map(item => item.id === id ? { ...item, requestDeletedAt: new Date().toISOString(), status: 'EXPIRED' } : item);
        this.eliminando = false;
        this.confirmacion.ocupado = false;
        this.confirmacion.cerrar();
        this.mensaje = 'Consulta retirada. La cotización sigue guardada en Mis cotizaciones.';
      },
      error: () => { this.eliminando = false; this.errorEliminar = 'No se pudo retirar la consulta. Vuelve a intentar.'; },
    });
  }
}
