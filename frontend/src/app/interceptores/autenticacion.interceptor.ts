import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { catchError, throwError } from "rxjs";
import { AuthService } from "../servicios/autenticacion.service";

const rutasPublicas = [
  "/api/auth/login", "/api/auth/register", "/api/health",
  "/api/catalog", "/api/builds/preview",
];

export const autenticacionInterceptor: HttpInterceptorFn = (request, next) => {
  const autenticacion = inject(AuthService);
  const router = inject(Router);
  const esApiInterna = request.url.startsWith("/api/");
  const esRutaPublica = rutasPublicas.includes(request.url);
  const token = autenticacion.token();

  const solicitudAutorizada =
    esApiInterna && !esRutaPublica && token
      ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : request;

  return next(solicitudAutorizada).pipe(
    catchError((error: HttpErrorResponse) => {
      if (esApiInterna && error.status === 401) {
        autenticacion.logout();
        void router.navigate(["/login"], {
          queryParams: { returnUrl: router.url },
        });
      }

      return throwError(() => error);
    }),
  );
};
