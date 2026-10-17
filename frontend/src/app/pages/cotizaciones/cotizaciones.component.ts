import { CommonModule } from "@angular/common";
import { Component, OnInit, ViewChild, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { QuoteService } from "../../servicios/cotizaciones.service";
import { ConfirmarAccionComponent } from '../../compartidos/confirmar-accion/confirmar-accion.component';
import { ResumenCotizacionComponent } from '../../compartidos/resumen-cotizacion/resumen-cotizacion.component';
import { Cotizacion, dinero, estadoCotizacion } from '../../modelos/cotizacion';
import { EditorCotizacionComponent } from '../../compartidos/editor-cotizacion/editor-cotizacion.component';
@Component({
  selector: "app-cotizaciones",
  standalone: true,
  imports: [CommonModule, RouterLink, ConfirmarAccionComponent, ResumenCotizacionComponent, EditorCotizacionComponent],
  templateUrl: "./cotizaciones.component.html",
  styleUrl: "../../estilos/paginas.scss",
})
export class CotizacionesComponent implements OnInit {
  private readonly servicio = inject(QuoteService);
  @ViewChild(ConfirmarAccionComponent) confirmacion!: ConfirmarAccionComponent;
  cotizaciones: Cotizacion[] = [];
  cargando = true;
  error = '';
  errorEliminar = '';
  mensaje = '';
  eliminando = false;
  pendiente?: Cotizacion;
  dinero = dinero;
  estado = estadoCotizacion;
  edicionGuardada(mensaje: string) {
    this.mensaje = mensaje;
    this.recargar();
  }
  ngOnInit() {
    this.recargar();
  }
  recargar() {
    this.cargando = true;
    this.error = '';
    this.servicio.list().subscribe({
      next: (datos) => {
        this.cotizaciones = datos;
        this.cargando = false;
      },
      error: () => { this.cargando = false; this.error = 'No se pudieron cargar tus cotizaciones. Intenta nuevamente.'; },
    });
  }
  pedirEliminar(cotizacion: Cotizacion) {
    this.pendiente = cotizacion;
    this.errorEliminar = '';
    this.confirmacion.abrir();
  }
  eliminar() {
    if (!this.pendiente || this.eliminando) return;
    const id = this.pendiente.id;
    this.eliminando = true;
    this.errorEliminar = '';
    this.servicio.remove(id).subscribe({
      next: () => {
        this.cotizaciones = this.cotizaciones.filter(item => item.id !== id);
        this.eliminando = false;
        this.confirmacion.ocupado = false;
        this.confirmacion.cerrar();
        this.mensaje = 'Cotización eliminada de tu historial.';
      },
      error: () => { this.eliminando = false; this.errorEliminar = 'No se pudo eliminar. No hemos quitado la cotización; vuelve a intentar.'; },
    });
  }
}
