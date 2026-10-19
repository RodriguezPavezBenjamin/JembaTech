# Complemento Railway IaC — solo lectura

Declaración versionada de los ajustes que no expone el proveedor Terraform
comunitario 0.6.2: healthchecks, migración previa y puerto del dominio. No es
un segundo gestor activo ni una migración de estado. `apply` se rechaza desde
el authoring file y no existe workflow de aplicación.

## Responsabilidad de cada herramienta

| Componente | Alcance autorizado en este repositorio |
| --- | --- |
| `infra/railway` | Adopción Terraform de 16 objetos existentes, estado EFS privado. No aplicar sin revisión/autorización separada. |
| Este directorio | Evaluar la declaración, contrastar un plan sin cambios y verificar ajustes/política por lectura. No adquirir propiedad, cambiar recursos ni variables. |
| `Railway staging` | Tras CI aprobada, desplegar el SHA exacto de los tres servicios de código. No desplegar PostgreSQL. |

El SDK nativo necesita un grafo completo (tres aplicaciones, Postgres y volumen):
**cinco nodos no son cinco recursos nuevos ni reemplazan los 16 de Terraform**.
No convertirlo en un parcial para intentar gestionar campos sueltos: la propiedad
nativa es por recurso, no una frontera compatible con la propiedad de Terraform.
No retirar imports, modificar el estado ni habilitar escritores concurrentes.

El modelo nativo declara `checkSuites: false`, pero eso no acredita que el
autodeploy esté desactivado. El ejecutor consulta y exige por separado autodeploy
desactivado y ausencia de espera de CI antes y después del plan. Así se conserva
el [único responsable de CD](../../docs/railway-staging.md), sin reintroducir el
ciclo corregido. No volver a activar los triggers por aplicar esta declaración.

## Comprobación offline (también en CI)

Node >=22.18 y SDK oficial `railway@3.12.0`, fijado mediante lockfile. Desde aquí:

```powershell
npm.cmd ci --ignore-scripts --no-audit --no-fund
npm.cmd test
npm.cmd audit --omit=dev --audit-level=high
```

En Linux usar `npm` en lugar de `npm.cmd`. Las pruebas evalúan el SDK real y
simulan el CLI: no requieren login, secretos, Railway CLI, Terraform ni acceso
cloud. La auditoría npm sí consulta el registro. El job `railway-native` mantiene
los gates existentes y es dependencia de Docker; no recibe secretos ni ejecuta
un plan cloud desde PRs. No añade dependencias a frontend/backend/Python.

## Plan real, sin cambios ni archivos sensibles

Prerequisitos: CLI Railway instalado (verificado con 5.70.0), login existente del propietario y esta
copia del repositorio vinculada al proyecto JembaTech Staging. No pedir un token
nuevo ni usar los antiguos tokens de Terraform o CD en esta terminal.

Desde la raíz del repositorio:

```powershell
node infra/railway-native/plan.mjs --check
```

En Windows detecta el `.exe` del CLI npm bajo AppData. En otras instalaciones
definir `RAILWAY_CLI` con su ruta absoluta (`railway` o `railway.exe`, no un wrapper
de shell). La variable `_` del proceso hijo apunta al mismo ejecutable para que
el SDK compruebe su versión real; no se falsea ni omite esa comprobación.

El ejecutor hace exclusivamente `status`, consultas GraphQL de configuración y
`config plan --json --detailed-exit-code`. Exige proyecto/entorno exactos, plan
sin cambios/diagnósticos, inventario completo, ajustes declarados y política CD.
No imprime respuestas privadas, guarda planes, exporta variables, ejecuta
`apply`, modifica la vinculación ni reintenta una operación fallida. Los tokens
Railway heredados se retiran del proceso hijo; usa solo el login existente.

Salida sanitizada verificada el 2026-10-19, antes de publicar este complemento:

```json
{"status":"ok","mode":"read-only-native-plan","plannedChanges":0,"nativeGraphResources":5,"healthchecks":3,"backendPreDeployDeclared":true,"frontendDomainPort":80,"variablesManaged":false,"remoteWrites":0,"autodeployServices":0,"ciWaitServices":0}
```

Las once pruebas del complemento y la auditoría npm (cero vulnerabilidades
reportadas) pasaron localmente. No equivale a CI/CD del futuro commit. El último
commit cloud comprobado antes de este cambio es `5ef1e07`: CI EP2 #17, Railway
staging #4 y salud de los cuatro componentes con ese mismo SHA.

## Límites que deben declararse en la entrega

Esto deja los ajustes explícitos, probados y contrastables; **no demuestra una
reconstrucción integral desde cero**. El grafo nativo no acredita imagen/montaje
recreables de Postgres, ni configura por sí solo autodeploy desactivado. Imagen,
montaje y variables no secretas siguen en Terraform; el ejecutor verifica además
la imagen de la instancia existente. Secretos, datos, restauración, permisos,
dominio y recuperación requieren su preparación correspondiente.

No hay aplicación nativa, transferencia de propiedad ni prueba de recuperación
de infraestructura completa. Pasar a un gestor único capaz de restaurar todo
requiere otro diseño y autorización. La guarda no sustituye los permisos de
cuenta: alguien que la elimine o aplique un plan externo podría modificar Railway.
No generar ni publicar planes guardados para sortearla.

Referencias primarias: [Railway IaC](https://docs.railway.com/infrastructure-as-code),
[referencia DSL](https://docs.railway.com/infrastructure-as-code/reference),
[CLI config](https://docs.railway.com/cli/config).
