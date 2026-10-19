# Staging preliminar

Actualización EP2, 2026-10-19: Railway ya está funcionando. Esta carpeta raíz
conserva exclusivamente el contrato local histórico de EP1. El módulo real
preparado está en [railway/](railway/README.md); falta adopción/importación y plan
cloud autorizado. No ejecutar apply de ese módulo con estado vacío.

La EP1 usa Terraform para validar un contrato reproducible de ambiente. No aprovisiona aun nube real: EP2 elegira proveedor y reemplazara `local_file` por red, ejecucion, almacenamiento y reglas de acceso.

```bash
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform fmt -check
terraform validate
terraform plan
```
