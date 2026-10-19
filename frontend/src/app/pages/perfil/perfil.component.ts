import { CommonModule } from "@angular/common";
import { Component, inject, OnInit } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { AuthService } from "../../servicios/autenticacion.service";
import { googleErrorMessage } from '../../servicios/google-auth.service';
@Component({
  selector: "app-perfil",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: "./perfil.component.html",
  styleUrl: "../../estilos/paginas.scss",
})
export class PerfilComponent implements OnInit {
  readonly autenticacion = inject(AuthService);
  private readonly formularioBuilder = inject(FormBuilder);
  readonly formulario = this.formularioBuilder.nonNullable.group({
    nombre: [this.autenticacion.user?.name || "", [Validators.required, Validators.minLength(2)]],
    telefono: [this.autenticacion.user?.phone || "", [Validators.required, Validators.minLength(8)]],
    contrasenaActual: ["", this.autenticacion.user?.authProvider === 'GOOGLE' ? [] : [Validators.required]],
    contrasenaNueva: ["", Validators.minLength(8)],
  });
  cargando = false;
  error = "";
  mensaje = "";
  googleDisponible = false;

  ngOnInit() {
    void this.autenticacion.google.prepare().then(available => { this.googleDisponible = available; });
  }

  vincularGoogle() {
    const password = this.formulario.controls.contrasenaActual.value;
    if (password.length < 8) { this.error = 'Escribe tu contraseña local actual antes de vincular Google.'; return; }
    this.cargando = true;
    this.error = '';
    this.autenticacion.loginGoogle(password).subscribe({
      next: session => {
        this.cargando = false;
        this.formulario.controls.contrasenaActual.clearValidators();
        this.formulario.controls.contrasenaActual.reset('');
        this.formulario.controls.contrasenaActual.updateValueAndValidity();
        this.formulario.controls.contrasenaNueva.reset('');
        this.mensaje = 'Google vinculado. Se conservaron tu cuenta, rol y cotizaciones.';
        window.dispatchEvent(new CustomEvent('jembatech-auth-change', { detail: session.user }));
      },
      error: error => { this.cargando = false; this.error = error?.error?.message || googleErrorMessage(error); },
    });
  }
  guardar() {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.error = "Completa los campos requeridos con datos válidos.";
      return;
    }

    this.cargando = true;
    this.error = "";
    this.mensaje = "";
    const datos = this.formulario.getRawValue();
    this.autenticacion
      .updateProfile({
        name: datos.nombre,
        phone: datos.telefono,
        ...(this.autenticacion.user?.authProvider === 'GOOGLE' ? {} : {
          currentPassword: datos.contrasenaActual, newPassword: datos.contrasenaNueva || undefined,
        }),
      })
      .subscribe({
        next: (sesion) => {
          this.cargando = false;
          this.formulario.reset({
            nombre: sesion.user.name,
            telefono: sesion.user.phone || "",
            contrasenaActual: "",
            contrasenaNueva: "",
          });
          this.mensaje = "Perfil actualizado y sesión renovada.";
          window.dispatchEvent(
            new CustomEvent("jembatech-auth-change", { detail: sesion.user }),
          );
        },
        error: (error) => {
          this.cargando = false;
          this.error =
            error?.error?.message || "No se pudo actualizar el perfil.";
        },
      });
  }
}
