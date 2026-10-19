import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from "@angular/core";
import { Producto } from "../../modelos/catalogo";

@Component({
  selector: "app-tarjeta-componente",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./tarjeta-componente.component.html",
  styleUrl: "./tarjeta-componente.component.scss",
})
export class TarjetaComponenteComponent implements OnChanges {
  @Input({ required: true }) producto!: Producto;
  @Input() seleccionado = false;
  @Input() motivo = "";
  @Input() multiple = false;
  @Input() recomendado = false;
  @Input() ocupado = false;
  @Input() cantidad = 0;
  @Input() maxCantidad = 8;
  fotoFallida = false;
  @Output() elegir = new EventEmitter<Producto>();
  @Output() quitar = new EventEmitter<Producto>();
  @Output() cantidadCambio = new EventEmitter<number>();

  ngOnChanges(changes: SimpleChanges) {
    const change = changes['producto'];
    if (change && (change.previousValue as Producto | undefined)?.image !== (change.currentValue as Producto).image) this.fotoFallida = false;
  }

  get activa() {
    return this.multiple ? this.cantidad > 0 : this.seleccionado;
  }

  alternar() {
    if (this.ocupado || (this.motivo && !this.activa)) return;
    if (this.activa) {
      if (this.multiple) this.cantidadCambio.emit(0);
      else this.quitar.emit(this.producto);
    } else {
      this.elegir.emit(this.producto);
    }
  }

  dinero(valor: number) {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(valor);
  }

  get precioPorActualizar() { const info = this.producto.priceInfo; return info?.kind === 'unavailable' || (info?.kind === 'observed' && !(Date.parse(info.expiresAt) > Date.now())); }
  get precioConsultado() { const info = this.producto.priceInfo; return info?.kind === 'observed' && !this.precioPorActualizar ? info : null; }
  get formatoOrientativo() { const fields = this.producto.specs['unverified']; return Array.isArray(fields) && fields.some(v => v === 'confirmar formatos de placa admitidos'); }
  medida(key: string, unit: string, prefix = '') { const value = this.producto.specs[key]; return typeof value === 'number' ? `${prefix}${value} ${unit}` : 'Por confirmar'; }

  get integrada() {
    return (
      this.producto.category === "gpu" &&
      this.producto.specs["integrated"] === true
    );
  }

  caracteristicas(): Array<{ label: string; value: string }> {
    const s = this.producto.specs;
    const list = (key: string) =>
      Array.isArray(s[key])
        ? (s[key] as Array<string | number>).join(" / ")
        : String(s[key] ?? "Por confirmar");
    switch (this.producto.category) {
      case "ram":
        return [
          { label: "POR MÓDULO", value: `${Number(s['capacityGb']) / Number(s['modules'])} GB` },
          { label: "PRESENTACIÓN", value: s['modules'] === 1 ? '1 módulo · cantidad elegible' : `${s['modules']} módulos · selección anterior` },
          { label: "VELOCIDAD", value: this.medida('speed', 'MT/s') },
        ];
      case "board":
        return [
          { label: "MEMORIA", value: `${s["ramSlots"]} slots · ${s["ram"]}` },
          { label: "CAPACIDAD RAM", value: this.medida('maxRam', 'GB', 'Hasta ') },
          {
            label: "ALMACENAMIENTO",
            value: `${s["m2"]} M.2 · ${s["sata"]} SATA`,
          },
          { label: "FORMATO", value: list("form") },
          { label: "RED", value: String(s["lan"] ?? "Consultar ficha") },
          {
            label: "INALÁMBRICO",
            value: String(s["wireless"] ?? (s["wifi"] === undefined ? 'Por confirmar' : s["wifi"] ? "Wi-Fi" : "Sin Wi-Fi")),
          },
        ];
      case "cooler":
        return s["kind"] === "stock"
          ? []
          : [
              {
                label: s["kind"] === "aio" ? "RADIADOR" : "ALTURA",
                value: `${s["kind"] === "aio" ? s["radiatorMm"] : s["heightMm"]} mm`,
              },
              {
                label: "VENTILADORES",
                value: s["includedFans"]
                  ? `${s["includedFans"]} ${s["includedFans"] === 1 ? "incluido" : "incluidos"}`
                  : "Consultar modelo",
              },
              { label: "MONTAJE", value: list("sockets") },
              {
                label: "TIPO",
                value:
                  s["kind"] === "aio"
                    ? "AIO · circuito cerrado"
                    : `${s["heatpipes"] ?? "—"} heatpipes`,
              },
            ];
      case "case":
        return [
          { label: "PLACAS", value: list("forms") },
          { label: "ESPACIO GPU", value: `Hasta ${s["gpuClearanceMm"]} mm` },
          {
            label: "COOLER POR AIRE",
            value: `Hasta ${s["coolerClearanceMm"]} mm`,
          },
          {
            label: "VENTILADORES",
            value: typeof s['included120'] === 'number' && typeof s['included140'] === 'number' ? `${Number(s["included120"]) + Number(s["included140"])} incluidos` : 'Por confirmar',
          },
          { label: "RADIADORES (MM)", value: list("radiators") },
          { label: "BAHÍAS", value: `${s["bays35"]} HDD · ${s["bays25"]} SSD` },
        ];
      case "fan":
        return [
          { label: "TAMAÑO", value: `${s["sizeMm"]} mm` },
          {
            label: "CONEXIÓN",
            value: String(s["connector"] ?? "Consultar modelo"),
          },
        ];
      case "support":
        return s["supportRange"]
          ? [
              { label: "ALTURA DE APOYO", value: String(s["supportRange"]) },
              { label: "CARGA MÁXIMA", value: String(s["maxLoad"]) },
            ]
          : [];
      default:
        return [];
    }
  }
}
