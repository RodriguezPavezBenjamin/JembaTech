import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from "@angular/core";

type Nodo = { x: number; y: number; r: number };
type Camino = { from: Nodo; to: Nodo };
type Particula = { path: Camino; t: number; speed: number };
type Columna = {
  col: number;
  x: number;
  y: number;
  speed: number;
  length: number;
  chars: string[];
  tick: number;
  tickMax: number;
  alpha: number;
  color: string;
};

@Component({
  selector: "app-fondo-circuitos",
  standalone: true,
  template: '<canvas #lienzo aria-hidden="true"></canvas>',
  styles: [
    ":host{position:fixed;inset:0;z-index:0;pointer-events:none}canvas{width:100%;height:100%;display:block}",
  ],
})
export class FondoCircuitosComponent implements AfterViewInit, OnDestroy {
  @ViewChild("lienzo", { static: true }) lienzo!: ElementRef<HTMLCanvasElement>;
  private contexto!: CanvasRenderingContext2D;
  private ancho = 0;
  private alto = 0;
  private nodos: Nodo[] = [];
  private particulas: Particula[] = [];
  private caminos: Camino[] = [];
  private columnas: Columna[] = [];
  private cuadro = 0;
  private readonly caracteres =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%&*<>{}[]|";
  private readonly redimensionar = () => {
    this.ancho = this.lienzo.nativeElement.width = window.innerWidth;
    this.alto = this.lienzo.nativeElement.height = window.innerHeight;
    this.iniciar();
  };
  ngAfterViewInit() {
    this.contexto = this.lienzo.nativeElement.getContext("2d")!;
    window.addEventListener("resize", this.redimensionar);
    this.redimensionar();
    this.dibujar();
  }
  ngOnDestroy() {
    window.removeEventListener("resize", this.redimensionar);
    cancelAnimationFrame(this.cuadro);
  }
  private oscuro() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  }
  private caracter() {
    return this.caracteres[Math.floor(Math.random() * 49)] || "0";
  }
  private iniciar() {
    this.nodos = [];
    this.caminos = [];
    this.particulas = [];
    this.columnas = [];
    const cols = Math.floor(this.ancho / 90),
      filas = Math.floor(this.alto / 90);
    for (let fila = 0; fila <= filas; fila++)
      for (let col = 0; col <= cols; col++)
        if (Math.random() < 0.5)
          this.nodos.push({
            x: col * 90 + (Math.random() - 0.5) * 40,
            y: fila * 90 + (Math.random() - 0.5) * 40,
            r: Math.random() < 0.1 ? 5 : 2.5,
          });
    for (let i = 0; i < this.nodos.length; i++)
      for (let j = i + 1; j < this.nodos.length; j++) {
        const dx = this.nodos[j].x - this.nodos[i].x,
          dy = this.nodos[j].y - this.nodos[i].y,
          distancia = Math.sqrt(dx * dx + dy * dy);
        if (distancia < 140 && Math.random() < 0.35) {
          const camino = { from: this.nodos[i], to: this.nodos[j] };
          this.caminos.push(camino);
          if (Math.random() < 0.3)
            this.particulas.push({
              path: camino,
              t: Math.random(),
              speed: 0.002 + Math.random() * 0.004,
            });
        }
      }
    const columnas = Math.floor(this.ancho / 16);
    for (let col = 0; col < columnas; col++)
      this.columnas.push({
        col,
        x: col * 16 + 8,
        y: Math.random() * this.alto,
        speed: 1.8 + Math.random() * 3.5,
        length: 10 + Math.floor(Math.random() * 20),
        chars: Array.from({ length: 20 }, () => this.caracter()),
        tick: 0,
        tickMax: 4 + Math.floor(Math.random() * 6),
        alpha: 0.4 + Math.random() * 0.6,
        color: Math.random() > 0.4 ? "#00d9ff" : "#ffffff",
      });
  }
  private dibujar = () => {
    const ctx = this.contexto;
    ctx.clearRect(0, 0, this.ancho, this.alto);
    if (!this.oscuro()) {
      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.textAlign = "center";
      for (const columna of this.columnas) {
        columna.y += columna.speed;
        columna.tick++;
        if (columna.tick >= columna.tickMax) {
          columna.tick = 0;
          columna.chars[Math.floor(Math.random() * columna.chars.length)] =
            this.caracter();
        }
        if (columna.y > this.alto + columna.length * 22) {
          columna.y = -columna.length * 22;
          columna.speed = 1.2 + Math.random() * 2.8;
        }
        for (let i = 0; i < columna.length; i++) {
          const y = columna.y - i * 16;
          if (y < 0 || y > this.alto) continue;
          const proporcion = 1 - i / columna.length;
          if (i === 0) {
            ctx.globalAlpha = columna.alpha;
            ctx.fillStyle = "#e0faff";
            ctx.shadowBlur = 12;
            ctx.shadowColor = "#00d9ff";
          } else if (i < 3) {
            ctx.globalAlpha = columna.alpha * 0.85;
            ctx.fillStyle = "#b7e8ff";
            ctx.shadowBlur = 4;
            ctx.shadowColor = "#00d9ff";
          } else {
            ctx.globalAlpha = columna.alpha * proporcion * 0.65;
            ctx.fillStyle = columna.color;
            ctx.shadowBlur = 0;
          }
          ctx.fillText(columna.chars[i % columna.chars.length], columna.x, y);
        }
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
    } else {
      ctx.strokeStyle = "rgba(0,180,0,0.12)";
      ctx.lineWidth = 1;
      for (const camino of this.caminos) {
        ctx.beginPath();
        ctx.moveTo(camino.from.x, camino.from.y);
        ctx.lineTo(camino.to.x, camino.from.y);
        ctx.lineTo(camino.to.x, camino.to.y);
        ctx.stroke();
      }
      for (const nodo of this.nodos) {
        ctx.beginPath();
        ctx.arc(nodo.x, nodo.y, nodo.r, 0, Math.PI * 2);
        ctx.fillStyle = nodo.r > 3 ? "#00ff44" : "rgba(0,220,0,0.35)";
        ctx.shadowBlur = nodo.r > 3 ? 10 : 0;
        ctx.shadowColor = "#00ff44";
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#39ff14";
      for (const particula of this.particulas) {
        particula.t += particula.speed;
        if (particula.t > 1) particula.t = 0;
        const avance = particula.t,
          camino = particula.path;
        let x: number, y: number;
        if (avance < 0.5) {
          x = camino.from.x + (camino.to.x - camino.from.x) * (avance * 2);
          y = camino.from.y;
        } else {
          x = camino.to.x;
          y =
            camino.from.y +
            (camino.to.y - camino.from.y) * ((avance - 0.5) * 2);
        }
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#39ff14";
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }
    this.cuadro = requestAnimationFrame(this.dibujar);
  };
}
