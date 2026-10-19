import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { catchError, from, switchMap, throwError } from "rxjs";
import { AuthService } from "../servicios/autenticacion.service";

const rutasPublicas = [
  "/api/auth/login", "/api/auth/register", "/api/health",
  "/api/catalog", "/api/builds/preview",
  '/api/auth/google', '/api/auth/google/config',
];

export const autenticacionInterceptor: HttpInterceptorFn = (request, next) => {
  const autenticacion = inject(AuthService);
  const router = inject(Router);
  const esApiInterna = request.url.startsWith("/api/");
  const esRutaPublica = rutasPublicas.includes(request.url);
  const token = autenticacion.token();

  if (esApiInterna && !esRutaPublica && autenticacion.user?.authProvider === 'GOOGLE') {
    return from(autenticacion.googleToken()).pipe(
      switchMap(idToken => next(request.clone({ setHeaders: { Authorization: `Bearer ${idToken}` } }))),
      catchError((error: unknown) => {
        // No cerrar sesión por un 403, validación, fallo de red o del servidor.
        if (!(error instanceof HttpErrorResponse) || error.status === 401) {
          autenticacion.logout();
          void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
        }
        return throwError(() => error);
      }),
    );
  }

  const solicitudAutorizada =
    esApiInterna && !esRutaPublica && token
      ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : request;

  return next(solicitudAutorizada).pipe(
    catchError((error: HttpErrorResponse) => {
      if (esApiInterna && !esRutaPublica && error.status === 401) {
        autenticacion.logout();
        void router.navigate(["/login"], {
          queryParams: { returnUrl: router.url },
        });
      }

      return throwError(() => error);
    }),
  );
};
