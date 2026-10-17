import { Routes } from "@angular/router";
import { authGuard, adminGuard } from "./guards/autenticacion.guard";
import { LayoutPrincipalComponent } from "./compartidos/layout-principal/layout-principal.component";

export const routes: Routes = [
  {
    path: "",
    pathMatch: "full",
    loadComponent: () =>
      import("./pages/cotizador/cotizador.component").then(
        (m) => m.CotizadorComponent,
      ),
  },
  {
    path: "login",
    component: LayoutPrincipalComponent,
    children: [
      {
        path: "",
        loadComponent: () =>
          import("./pages/inicio-sesion/inicio-sesion.component").then(
            (m) => m.InicioSesionComponent,
          ),
      },
    ],
  },
  {
    path: "perfil",
    component: LayoutPrincipalComponent,
    canActivate: [authGuard],
    children: [
      {
        path: "",
        loadComponent: () =>
          import("./pages/perfil/perfil.component").then(
            (m) => m.PerfilComponent,
          ),
      },
    ],
  },
  {
    path: "cotizaciones",
    component: LayoutPrincipalComponent,
    canActivate: [authGuard],
    children: [
      {
        path: "",
        loadComponent: () =>
          import("./pages/cotizaciones/cotizaciones.component").then(
            (m) => m.CotizacionesComponent,
          ),
      },
    ],
  },
  {
    path: "consultas",
    component: LayoutPrincipalComponent,
    canActivate: [authGuard],
    children: [
      {
        path: "",
        loadComponent: () =>
          import("./pages/consultas/consultas.component").then(
            (m) => m.ConsultasComponent,
          ),
      },
    ],
  },
  {
    path: "admin/cotizaciones-clientes",
    component: LayoutPrincipalComponent,
    canActivate: [adminGuard],
    children: [
      {
        path: "",
        loadComponent: () =>
          import(
            "./pages/cotizaciones-clientes/cotizaciones-clientes.component"
          ).then((m) => m.CotizacionesClientesComponent),
      },
    ],
  },
  {
    path: "admin/fuentes",
    component: LayoutPrincipalComponent,
    canActivate: [adminGuard],
    children: [{ path: "", loadComponent: () => import("./pages/fuentes/fuentes.component").then(m => m.FuentesComponent) }],
  },
  {
    path: "admin/cotizaciones",
    redirectTo: "admin/cotizaciones-clientes",
    pathMatch: "full",
  },
];
