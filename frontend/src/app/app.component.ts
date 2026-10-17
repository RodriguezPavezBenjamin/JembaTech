import { Component, DestroyRef, OnInit, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router, RouterOutlet } from "@angular/router";
import { filter } from "rxjs";
import { AuthService } from "./servicios/autenticacion.service";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: "./app.component.html",
  styles: [":host { display: block; }"],
})
export class AppComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  readonly esInicio = signal(window.location.pathname === "/");

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.sincronizarRuta());
  }

  ngOnInit() {
    document.documentElement.classList.toggle("ruta-angular", !this.esInicio());
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("jembatech-auth-change", {
          detail: this.auth.user ?? null,
        }),
      );
    });
  }

  private sincronizarRuta() {
    const home = this.router.url.split(/[?#]/)[0] === "/";
    this.esInicio.set(home);
    document.documentElement.classList.toggle("ruta-angular", !home);
    if (home && this.router.url.includes("#cotizador")) {
      setTimeout(() =>
        document
          .getElementById("cotizador")
          ?.scrollIntoView({ block: "start" }),
      );
    }
  }
}
