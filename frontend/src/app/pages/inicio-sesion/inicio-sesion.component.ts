import { CommonModule } from "@angular/common";
import { Component, inject, OnInit } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { AppUser, AuthService } from "../../servicios/autenticacion.service";
import { googleErrorMessage } from '../../servicios/google-auth.service';
@Component({
  selector: "app-inicio-sesion",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: "./inicio-sesion.component.html",
  styleUrl: "./inicio-sesion.component.scss",
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
  mostrarContrasena = false;
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
        this.finalizarAcceso(session.user);
      },
      error: error => {
        this.cargando = false;
        this.error = error?.error?.message || googleErrorMessage(error);
      },
    });
  }

  enviar() {
    if (this.cargando) return;
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
        this.finalizarAcceso(sesion.user);
      },
      error: (error) => {
        this.cargando = false;
        this.error =
          error?.error?.message || "No fue posible acceder. Revisa los datos.";
      },
    });
  }

  private finalizarAcceso(usuario: AppUser) {
    this.cargando = false;
    window.dispatchEvent(new CustomEvent("jembatech-auth-change", { detail: usuario }));
    const destino = this.ruta.snapshot.queryParamMap.get("returnUrl");
    // El acceso normal vuelve a la portada; guardar un armado conserva su regreso.
    void this.router.navigateByUrl(
      destino && destino.startsWith("/") && !destino.startsWith("//") && !destino.includes("\\")
        ? destino : "/",
    );
  }

  cambiarModo(modo: "login" | "registro" = this.modo === "login" ? "registro" : "login") {
    if (this.cargando || this.modo === modo) return;
    this.modo = modo;
    this.error = "";
    this.mostrarContrasena = false;
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
