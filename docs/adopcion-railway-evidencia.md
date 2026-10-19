# Evidencia sanitizada de adopción Railway

Corte: **2026-10-19**. Resultado comunicado por el propietario desde su terminal
Windows, con Terraform nativo 1.16.4 y proveedor comunitario Railway 0.6.2.
El asistente no recibió el token ni descifró el estado o los planes privados.

## Resultado real

- Preflight autenticado: proyecto y entorno staging esperados, cuatro servicios,
  staging confirmado como entorno predeterminado elegido por el proveedor.
- Primer import: un proyecto existente, identidad confirmada y estado cifrado.
- Segundo ejecutor: 15 imports adicionales, uno previamente asociado, total 16.
- Plan normal autenticado, con refresh: resultado sanitizado siguiente.

```json
{"status":"ok","resources":16,"changes":0,"observedDrift":0,"filesEncrypted":true,"logName":"adoption-bc33684c-584a-4adb-b0b4-38fd7827a9f5.plan.log"}
```

Los 16 objetos son: proyecto, tres servicios de aplicación, servicio Postgres,
dominio frontend y diez variables individuales. El ejecutor comprueba todas las
direcciones/identidades antes de aceptar el resultado: un plan vacío o parcial
no lo satisface. No se ejecutó `apply`, `destroy`, recreación de la base ni cambio
de variables/servicios. No es una autorización para aplicar futuros planes.

Estado, backup de estado, plan binario, JSON y registros permanecen fuera de Git,
en almacenamiento privado con EFS. No adjuntarlos como artifacts ni copiarlos al
repositorio. El respaldo PostgreSQL se restauró en una base temporal aislada;
existe copia cifrada y recuperación EFS protegida por contraseña en disco externo.
Las copias previas sin EFS no se han borrado: no se afirma que todas estén cifradas.

## Límites y cierre de acceso

El proveedor no modela healthchecks, pre-deploy, Wait for CI ni puerto del dominio;
CD los verifica, pero no los aprovisiona. Postgres mantiene protecciones sobre
imagen/volumen. No se acredita reproducción integral de infraestructura, secretos
o datos desde cero, ni un backend remoto apto para varios operadores.

El módulo y los ejecutores todavía tienen cambios locales sobre HEAD
`c4dd5dd767c3a9dfd78c87ff196ab85fca619dba`. El plan corresponde a esa configuración
local; no afirmar que ese HEAD ya contiene la adopción. Antes del cierre final,
publicar el commit elegido y conservar su propia CI/CD y evidencias.

El propietario confirmó la revocación de `jembatech-terraform-temporal` después
de identificarlo en los tokens de cuenta. Se conserva el token de CD
`github-actions-staging` y el Secret `RAILWAY_STAGING_TOKEN`. El comando para
retirar su copia local es `Remove-Item Env:RAILWAY_TOKEN -ErrorAction SilentlyContinue`;
no se inspecciona el entorno privado del propietario para comprobarlo.

[Procedimiento y controles](../infra/railway/README.md),
[despliegue y salud](railway-staging.md), [checklist final](cierre-ep2.md).
