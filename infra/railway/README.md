# Adopción Terraform de Railway staging

Estado: inicialización y validación nativas completadas; el propietario confirmó
los **16 imports reales**, sus identidades y el estado cifrado el **2026-10-19**
mediante los resúmenes de ambos ejecutores. También confirmó el plan real:
**16 recursos, cero cambios y cero diferencias observadas**, con archivos cifrados.
[Evidencia sanitizada y límites](../../docs/adopcion-railway-evidencia.md).
No se ha ejecutado `apply`. Las pruebas con `mock_provider` son evidencia de
diseño separada del resultado real aportado desde la terminal del propietario.
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
ajustes aún exige un mecanismo soportado; el plan real sin cambios acredita la
adopción de los 16 objetos modelados, no la reproducción íntegra de esos ajustes.

## Preparación, sin mutaciones cloud

Inventario confirmado por el propietario el **2026-10-19**, desde las URLs de
Settings y la configuración del volumen. No equivale a una consulta autenticada
ni a recursos importados:

| Recurso | ID existente |
| --- | --- |
| Proyecto JembaTech Staging | `8aa2ee89-8dfa-4251-a8f3-7a6f35adf9c2` |
| Entorno staging | `7d352239-5259-4f92-8861-c6855df5ea19` |
| backend | `6218c32a-38a3-4c63-82a5-e36e44b9a72b` |
| frontend | `2d33a057-3733-41b7-b45d-11043750244b` |
| python-service | `4f1950ea-e4b1-4a62-bd0b-3f38861eb5c6` |
| Postgres | `e0c2d481-2475-4ddb-87ea-bb020e09c3a2` |

Imagen: `ghcr.io/railwayapp-templates/postgres-ssl:18`. Volumen:
`postgres-volume`, montado en `/var/lib/postgresql/data`.
Dominio frontend: `jembatech.up.railway.app`.

1. Confirmar copia/restauración de PostgreSQL y un estado Terraform protegido.
   Nunca usar Git ni artifacts de Actions para estado, planes binarios o JSON de
   planes: pueden contener secretos aunque la salida de terminal los oculte.
   Para la adopción local, usar disco protegido y copia cifrada; acordar backend
   remoto con bloqueo antes de operar Terraform desde CI o varios equipos.
2. Verificar que el inventario anterior sigue vigente y staging es el entorno
   predeterminado elegido por el proveedor. No pegar contraseñas ni cadenas
   DATABASE_URL en el chat.
3. El proveedor requiere token de cuenta/workspace para gestionar todos estos
   recursos. NO reutilizar el token limitado de CD ni pedir uno amplio al chat.
   El propietario puede configurarlo localmente como `RAILWAY_TOKEN` por un canal
   de secretos, sin escribir el valor en comandos/historial/tfvars. Retirarlo al
   finalizar. Este acceso es más amplio que el token de proyecto usado por CD:
   requiere autorización expresa del propietario antes de configurarlo. La
   versión fijada envía `Authorization: Bearer`, no `Project-Access-Token`.
   El propietario ya creó el acceso temporal y verificó el inventario desde su
   terminal; su valor no se ha recibido ni guardado en el repositorio.
4. Configurar solo `postgres_source_image` y `postgres_mount_path` con los valores
   existentes en un `terraform.tfvars` local ignorado. El archivo versionado
   `terraform.tfvars.example` contiene únicamente los dos valores confirmados.
   No elegir una imagen nueva ni agregar credenciales al ejemplo.

### Sesión local Windows y estado protegido

La adopción real se realiza desde PowerShell del propietario con Terraform
**nativo de Windows**. EFS necesita su certificado y contexto de usuario: si otra
sesión no puede leer los archivos cifrados, no ampliar permisos ni exportarle la
clave privada para resolverlo. Docker/CI se usan para validación offline, no para
montar el estado EFS. El `.pfx` de recuperación debe tener contraseña comprobada
y copia en un dispositivo independiente; nunca se versiona ni se adjunta al chat.

El bloque `backend "local" {}` es parcial. Sus rutas deben configurarse antes de
importar. El ejemplo siguiente usa la carpeta privada elegida para esta adopción;
verificar que exista y esté cifrada. No pasar credenciales mediante backend-config.
No inicializar de nuevo sobre un estado existente sin revisar su configuración.

Desde esta carpeta, todavía **sin token ni consultas cloud**:

```powershell
$stateRoot = "D:/Accesos HDD/-.Benja.-/JembaTech privado/Terraform"
if (-not ((Get-Item -LiteralPath $stateRoot -ErrorAction Stop).Attributes -band [System.IO.FileAttributes]::Encrypted)) {
    throw "La carpeta de estado debe estar cifrada antes de continuar."
}
$env:TF_DATA_DIR = "$stateRoot/.terraform"
terraform init -input=false -lockfile=readonly "-backend-config=path=$stateRoot/staging.tfstate" "-backend-config=workspace_dir=$stateRoot/workspaces"
terraform fmt -check -recursive
terraform validate
```

Detenerse ante cualquier error. Utilizar solo el workspace Terraform `default`;
el entorno Railway `staging` es independiente de ese nombre. Estado, backups del
estado, metadatos del backend y planes quedan bajo `$stateRoot`. El backend local
no aporta cifrado por sí mismo: la protección depende de EFS y del usuario.
No se ha creado estado de infraestructura con esta preparación.

### Credencial temporal, solo en la terminal del propietario

Crear un token en los ajustes de **cuenta**, seleccionando únicamente el workspace
que contiene JembaTech. No elegir `No workspace` ni sustituir el token de CD en
GitHub. Si no aparece ese workspace, detenerse: un token de cuenta amplía el
alcance y requiere una decisión separada. No agregar este token a los servicios
Railway, a `.env`, a tfvars, al historial ni a capturas.

Solo cuando la inicialización esté verificada, introducirlo sin eco en la misma
PowerShell. No ejecutar con transcripción o registro de depuración activo:

```powershell
if (Test-Path Env:RAILWAY_TOKEN) {
    throw "Ya hay un token en esta sesión; no se sobrescribirá."
}
$tokenSeguro = Read-Host "Token temporal del workspace (no compartir)" -AsSecureString
$tokenBstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($tokenSeguro)
try {
    $env:RAILWAY_TOKEN = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenBstr)
} finally {
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenBstr)
    $tokenSeguro.Dispose()
}
```

La variable se mantiene únicamente en el proceso para los comandos Terraform;
no se escribe con el valor literal en el historial. No ejecutar comandos Railway
CLI con ese `RAILWAY_TOKEN`: el CLI y este proveedor usan convenciones distintas.
Antes de importar, comprobar por lectura autenticada los IDs y el entorno
predeterminado. No existe autorización para `apply`, `destroy` ni mutaciones API.

```powershell
node ../../scripts/check-railway-adoption-scope.mjs
```

Este comprobador hace una sola consulta con `Authorization: Bearer` al API
oficial, exige los cuatro IDs confirmados y que staging sea el entorno más
antiguo (como lo elige el proveedor fijado). Solo imprime un resumen sanitizado.
No persiste la respuesta, no acepta otros destinos y no ejecuta Terraform.
Detenerse ante errores; un 429 no se reintenta automáticamente.

## Importar antes de planificar o aplicar

### Primer recurso desde Windows PowerShell

En Windows PowerShell 5, una línea de stderr de un programa nativo puede
interrumpir la captura con `NativeCommandError` cuando está activo
`$ErrorActionPreference = 'Stop'`. Un prefijo como `ÔòÀ` no identifica la causa
del fallo. No repetir a ciegas el bloque de redirección ni borrar el estado.

Desde la raíz del repositorio, en la misma terminal del propietario que conserva
el token y puede descifrar EFS, usar el ejecutor del primer recurso:

```powershell
node .\scripts\import-railway-project.mjs
```

Comprueba el backend privado, EFS, el inventario y la ausencia de estado previo.
Ejecuta una sola importación del proyecto con el Terraform Windows fijado, sin
shell ni reintentos. Cifra el registro vacío antes de escribir la salida nativa;
no imprime esa salida, el token ni el estado. Comprueba el cifrado y la identidad
del estado resultante. Solo compartir el JSON sanitizado que devuelve.

Si devuelve `STATE_ALREADY_EXISTS_DO_NOT_REIMPORT`, detenerse y revisar el estado
por lectura; no eliminarlo, desbloquearlo a la fuerza ni importar otra vez.
Cualquier otro error también exige revisión antes de continuar. Las pruebas del
ejecutor usan dobles locales: no acreditan una importación real satisfactoria.

### Restantes 15 objetos existentes

Una vez confirmado el primer import, desde la raíz del repositorio y la misma
terminal con acceso EFS/token temporal:

```powershell
node .\scripts\import-railway-resources.mjs
```

El ejecutor revisa el backend, cifrado, identidad y linaje del estado. Solo admite
las 16 direcciones previstas y sus IDs exactos; omite las ya importadas con
identidad correcta. Ejecuta secuencialmente los imports pendientes, con un
registro cifrado por operación y comprobación posterior de estado y backup.
No crea recursos, modifica variables ni despliega servicios: los métodos
ImportState/Read del proveedor fijado solo leen los objetos existentes.
No ejecuta `apply`, `destroy`, borrados de estado ni desbloqueos forzados.

Entrega progreso y resultado sanitizado (`total: 16` cuando termina), sin valores
de variables ni contenido de estado. Ante un error se detiene sin reintentar;
conservar el estado y revisar el código antes de reanudar. Un total de 16 aún no
demuestra ausencia de diferencias: falta ejecutar y revisar el plan real.

### Referencia de identificadores para la adopción completa

`terraform import` asocia recursos al estado y lee Railway; no crea servicios.
Los comandos siguientes ya contienen los IDs confirmados. Ejecutarlos solamente
después de resolver respaldo, estado protegido y autorización de acceso. No
ejecutar `terraform apply` sobre un estado
vacío: aunque haya prevent_destroy, eso no impide crear duplicados facturables.
Son una referencia de direcciones e IDs, no un bloque para ejecutar después del
ejecutor anterior: no repetir el proyecto ya importado. En Windows PowerShell 5
preparar también una invocación nativa segura para las direcciones con comillas.

```powershell
terraform import railway_project.staging 8aa2ee89-8dfa-4251-a8f3-7a6f35adf9c2
terraform import 'railway_service.application["python-service"]' 4f1950ea-e4b1-4a62-bd0b-3f38861eb5c6
terraform import 'railway_service.application["backend"]' 6218c32a-38a3-4c63-82a5-e36e44b9a72b
terraform import 'railway_service.application["frontend"]' 2d33a057-3733-41b7-b45d-11043750244b
terraform import railway_service.postgres e0c2d481-2475-4ddb-87ea-bb020e09c3a2
terraform import railway_service_domain.frontend '2d33a057-3733-41b7-b45d-11043750244b:staging:jembatech.up.railway.app'
```

Importar también cada `railway_variable.setting` con el identificador documentado
`ID_SERVICIO:staging:NOMBRE_VARIABLE`:

```powershell
terraform import 'railway_variable.setting["python-service.PORT"]' '4f1950ea-e4b1-4a62-bd0b-3f38861eb5c6:staging:PORT'
terraform import 'railway_variable.setting["python-service.SOLOTODO_MANUAL_PROBE_ENABLED"]' '4f1950ea-e4b1-4a62-bd0b-3f38861eb5c6:staging:SOLOTODO_MANUAL_PROBE_ENABLED'
terraform import 'railway_variable.setting["backend.PORT"]' '6218c32a-38a3-4c63-82a5-e36e44b9a72b:staging:PORT'
terraform import 'railway_variable.setting["backend.NODE_ENV"]' '6218c32a-38a3-4c63-82a5-e36e44b9a72b:staging:NODE_ENV'
terraform import 'railway_variable.setting["backend.DATABASE_URL"]' '6218c32a-38a3-4c63-82a5-e36e44b9a72b:staging:DATABASE_URL'
terraform import 'railway_variable.setting["backend.PYTHON_SERVICE_URL"]' '6218c32a-38a3-4c63-82a5-e36e44b9a72b:staging:PYTHON_SERVICE_URL'
terraform import 'railway_variable.setting["backend.SOLOTODO_MANUAL_PROBE_ENABLED"]' '6218c32a-38a3-4c63-82a5-e36e44b9a72b:staging:SOLOTODO_MANUAL_PROBE_ENABLED'
terraform import 'railway_variable.setting["frontend.PORT"]' '2d33a057-3733-41b7-b45d-11043750244b:staging:PORT'
terraform import 'railway_variable.setting["frontend.BACKEND_HOST"]' '2d33a057-3733-41b7-b45d-11043750244b:staging:BACKEND_HOST'
terraform import 'railway_variable.setting["frontend.BACKEND_PORT"]' '2d33a057-3733-41b7-b45d-11043750244b:staging:BACKEND_PORT'
```

Detenerse ante el primer error de importación; no continuar con un plan parcial.
Confirmar que staging es el
entorno más antiguo del proyecto: así lo selecciona este proveedor. Detenerse si
no coincide. No importar el mismo objeto bajo dos direcciones Terraform.

## Validar adopción, no aplicar cambios

Con los 16 imports confirmados, ejecutar desde la raíz del repositorio en la
misma terminal Windows con EFS y token temporal:

```powershell
node .\scripts\plan-railway-adoption.mjs
```

El ejecutor comprueba backend, las 16 identidades importadas y el cifrado. Crea
archivos únicos de plan, JSON y registro en el almacenamiento privado; cifra los
archivos vacíos antes de escribir. Ejecuta un plan normal, con refresh habilitado,
sin `target`, `refresh-only`, `apply` ni reintentos. Usa `-parallelism=1` y captura
la salida nativa sin el problema de redirección de Windows PowerShell 5.
`show -json` se ejecuta localmente sin token. El estado debe permanecer intacto.

El control requiere un plan completo de las **16 direcciones exactas**, sin crear,
actualizar, borrar, reemplazar ni importar objetos nuevos. Si hay diferencias,
devuelve `TF_PLAN_HAS_CHANGES` y solo direcciones, acciones y nombres de atributos
permitidos; nunca valores. Si no las hay, devuelve `status: ok`, `resources: 16`
y `changes: 0`. `observedDrift` informa por separado el número de diferencias de
refresh que Terraform haya observado, incluso si no propone escrituras.
Los cambios solo en outputs pueden dar código nativo 2 sin proponer cambios de
recursos: no se aplica ese plan para actualizar outputs en esta fase.

Si falla, ajustar declaraciones a lo existente. No ocultar diferencias con más
`ignore_changes` ni ejecutar apply para hacerlas desaparecer. El JSON de plan se
ignora y debe conservarse solo en almacenamiento privado. Nunca publicarlo como
evidencia. Documentar por separado el resultado sanitizado: fecha, SHA y cero
cambios. Una futura modificación requiere revisión, copia de seguridad y permiso
del propietario; aquí no se automatiza apply ni destroy.

Al terminar o interrumpir la adopción, retirar el token de la sesión con
`Remove-Item Env:RAILWAY_TOKEN -ErrorAction SilentlyContinue`, cerrar la terminal
y **revocar el token temporal en Railway**. No borrar ni rotar el token de CD.
No publicar registros, JSON ni snapshots; compartir solamente el resultado
sanitizado del control y, cuando exista, la evidencia de cero cambios.

Fuentes: [proveedor y recursos](https://github.com/terraform-community-providers/terraform-provider-railway/tree/v0.6.2/docs),
[autenticación del proveedor fijado](https://github.com/terraform-community-providers/terraform-provider-railway/blob/v0.6.2/internal/provider/client.go),
[tokens de la API Railway](https://docs.railway.com/integrations/api),
[importar recursos existentes](https://developer.hashicorp.com/terraform/cli/import/usage),
[plan sin aplicar cambios](https://developer.hashicorp.com/terraform/cli/commands/plan),
[formato JSON del plan](https://developer.hashicorp.com/terraform/internals/json-format),
[estado sensible](https://developer.hashicorp.com/terraform/language/state/sensitive-data),
[backend local y bloqueo](https://developer.hashicorp.com/terraform/language/backend/local),
[configuración Railway](https://docs.railway.com/config-as-code/reference).
