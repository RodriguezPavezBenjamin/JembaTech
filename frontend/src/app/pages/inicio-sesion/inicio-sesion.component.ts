import { CommonModule } from "@angular/common";
import { Component, inject, OnInit } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { AuthService } from "../../servicios/autenticacion.service";
import { googleErrorMessage } from '../../servicios/google-auth.service';
@Component({
  selector: "app-inicio-sesion",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: "./inicio-sesion.component.html",
  styleUrl: "../../estilos/paginas.scss",
})
export class InicioSesionComponent implements OnInit {
  private readonly autenticacion = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly formularioBuilder = inject(FormBuilder);

  modo: "login" | "registro" = "login";
  readonly formulario = this.formularioBuilder.nonNullable.group({
    nombre: [""],
    correo: ["", [Validators.required, Validators.email]],
    contrasena: ["", Validators.required],
    telefono: [""],
  });
  cargando = false;
  error = "";
  googleDisponible = false;
  readonly googleNativoPendiente = this.autenticacion.google.nativePlatform;

  ngOnInit() {
    void this.autenticacion.google.prepare().then(available => { this.googleDisponible = available; });
  }

  ingresarGoogle() {
    if (this.cargando) return;
    this.cargando = true;
    this.error = '';
    this.autenticacion.loginGoogle().subscribe({
      next: session => {
        this.cargando = false;
        window.dispatchEvent(new CustomEvent('jembatech-auth-change', { detail: session.user }));
        const destino = this.ruta.snapshot.queryParamMap.get('returnUrl');
        void this.router.navigateByUrl(destino && destino.startsWith('/') && !destino.startsWith('//') ? destino : '/perfil');
      },
      error: error => {
        this.cargando = false;
        this.error = error?.error?.message || googleErrorMessage(error);
      },
    });
  }

  enviar() {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.error = "Completa los campos requeridos con datos válidos.";
      return;
    }

    this.cargando = true;
    this.error = "";
    const datos = this.formulario.getRawValue();
    const solicitud =
      this.modo === "login"
        ? this.autenticacion.login({
            email: datos.correo,
            password: datos.contrasena,
          })
        : this.autenticacion.register({
            name: datos.nombre,
            email: datos.correo,
            password: datos.contrasena,
            phone: datos.telefono,
          });
    solicitud.subscribe({
      next: (sesion) => {
        this.cargando = false;
        window.dispatchEvent(
          new CustomEvent("jembatech-auth-change", { detail: sesion.user }),
        );
        const destino = this.ruta.snapshot.queryParamMap.get("returnUrl");
        this.router.navigateByUrl(
          destino && destino.startsWith("/") && !destino.startsWith('//') ? destino : "/perfil",
        );
      },
      error: (error) => {
        this.cargando = false;
        this.error =
          error?.error?.message || "No fue posible acceder. Revisa los datos.";
      },
    });
  }

  cambiarModo() {
    this.modo = this.modo === "login" ? "registro" : "login";
    this.error = "";
    const nombre = this.formulario.controls.nombre;
    const telefono = this.formulario.controls.telefono;
    const contrasena = this.formulario.controls.contrasena;

    if (this.modo === "registro") {
      nombre.setValidators([Validators.required, Validators.minLength(2)]);
      telefono.setValidators([Validators.required, Validators.minLength(8)]);
      contrasena.setValidators([Validators.required, Validators.minLength(8)]);
    } else {
      nombre.clearValidators();
      telefono.clearValidators();
      contrasena.setValidators(Validators.required);
    }

    nombre.updateValueAndValidity();
    telefono.updateValueAndValidity();
    contrasena.updateValueAndValidity();
  }
}
