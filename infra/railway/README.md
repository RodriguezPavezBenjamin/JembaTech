# Adopción Terraform de Railway staging

Estado: módulo real preparado y validado **sin conexión a Railway**. No se han
importado recursos ni ejecutado `apply`. Las pruebas con `mock_provider` verifican
el diseño; no constituyen un `plan` real ni acreditan infraestructura adoptada.
El contrato EP1 de la carpeta superior se conserva como histórico, no como nube.

## Alcance y protecciones

Proveedor **comunitario, no oficial** `terraform-community-providers/railway@0.6.2`.
Se fijan versión y checksums. Define proyecto privado, entorno predeterminado
staging, tres servicios GitHub, Postgres con volumen, diez variables no secretas
y solo el dominio frontend. `prevent_destroy` bloquea reemplazos y eliminaciones.
Postgres ignora cambios de imagen y volumen durante esta adopción: el proveedor
puede borrar un volumen también desde Update, no solo al destruir el servicio.

No hay `railway_variable_collection`: no se reemplazan colecciones de variables
que puedan borrar Firebase, JWT u otras configuraciones existentes. Las variables
secretas siguen en Railway y deben respaldarse por un mecanismo seguro del
propietario. Terraform es una parte de la reproducibilidad, no una copia completa
de credenciales/datos. La base NO se recrea ni se migra con este módulo.

Limitaciones del proveedor revisado: las opciones healthcheck, pre-deploy, Wait for
CI y puerto del dominio no están modeladas por este recurso. Actualmente son la
configuración ya existente descrita en `docs/railway-staging.md`, comprobada por
CD antes de desplegar. No se agregan archivos `railway.toml/json` de legado:
Railway anuncia su retirada para 2026-12-01. La reproducción completa de esos
ajustes aún exige completar la adopción y su mecanismo soportado; no dar IaC por
cerrada solo por aprobar los mocks.

## Preparación, sin mutaciones cloud

1. Confirmar copia/restauración de PostgreSQL y un estado Terraform protegido.
   Nunca usar Git ni artifacts de Actions para estado, planes binarios o JSON de
   planes: pueden contener secretos aunque la salida de terminal los oculte.
   Para la adopción local, usar disco protegido y copia cifrada; acordar backend
   remoto con bloqueo antes de operar Terraform desde CI o varios equipos.
2. Obtener los IDs existentes de los cuatro servicios; imagen exacta y mount path
   de `postgres-volume`. No pegar contraseñas ni cadenas DATABASE_URL en el chat.
   Proyecto conocido: `8aa2ee89-8dfa-4251-a8f3-7a6f35adf9c2`.
3. El proveedor requiere token de cuenta/workspace para gestionar todos estos
   recursos. NO reutilizar el token limitado de CD ni pedir uno amplio al chat.
   El propietario puede configurarlo localmente como `RAILWAY_TOKEN` por un canal
   de secretos, sin escribir el valor en comandos/historial/tfvars. Retirarlo al
   finalizar. No se ha creado ni recibido ese acceso.
4. Configurar solo `postgres_source_image` y `postgres_mount_path` con los valores
   existentes en un `terraform.tfvars` local ignorado. No elegir una imagen nueva.

Desde esta carpeta:

```powershell
terraform init -input=false -lockfile=readonly
terraform fmt -check -recursive
terraform validate
```

## Importar antes de planificar o aplicar

`terraform import` asocia recursos al estado y lee Railway; no crea servicios.
Reemplazar los IDs en los ejemplos. No ejecutar `terraform apply` sobre un estado
vacío: aunque haya prevent_destroy, eso no impide crear duplicados facturables.

```powershell
terraform import railway_project.staging 8aa2ee89-8dfa-4251-a8f3-7a6f35adf9c2
terraform import 'railway_service.application["python-service"]' ID_PYTHON
terraform import 'railway_service.application["backend"]' ID_BACKEND
terraform import 'railway_service.application["frontend"]' ID_FRONTEND
terraform import railway_service.postgres ID_POSTGRES
terraform import railway_service_domain.frontend 'ID_FRONTEND:staging:jembatech.up.railway.app'
```

Importar también cada `railway_variable.setting` con el identificador documentado
`ID_SERVICIO:staging:NOMBRE_VARIABLE`, por ejemplo:

```powershell
terraform import 'railway_variable.setting["backend.PORT"]' 'ID_BACKEND:staging:PORT'
```

Repetir para las diez claves de `local.settings`. Confirmar que staging es el
entorno más antiguo del proyecto: así lo selecciona este proveedor. Detenerse si
no coincide. No importar el mismo objeto bajo dos direcciones Terraform.

## Validar adopción, no aplicar cambios

```powershell
terraform plan -input=false -out=adoption.tfplan
terraform show -json adoption.tfplan > adoption.plan.json
node ../../scripts/check-terraform-adoption.mjs adoption.plan.json
```

El control requiere un plan completo **sin crear, actualizar, borrar ni reemplazar**.
Si falla, ajustar declaraciones a lo existente. No ocultar diferencias con más
`ignore_changes` ni ejecutar apply para hacerlas desaparecer. El JSON de plan se
ignora y debe conservarse solo en almacenamiento privado. Nunca publicarlo como
evidencia. Documentar por separado el resultado sanitizado: fecha, SHA y cero
cambios. Una futura modificación requiere revisión, copia de seguridad y permiso
del propietario; aquí no se automatiza apply ni destroy.

Fuentes: [proveedor y recursos](https://github.com/terraform-community-providers/terraform-provider-railway/tree/v0.6.2/docs),
[importar recursos existentes](https://developer.hashicorp.com/terraform/cli/import/usage),
[estado sensible](https://developer.hashicorp.com/terraform/language/state/sensitive-data),
[configuración Railway](https://docs.railway.com/config-as-code/reference).
