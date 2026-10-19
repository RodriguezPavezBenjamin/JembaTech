variable "postgres_source_image" {
  type        = string
  description = "Imagen EXACTA ya desplegada en Postgres; obtenerla antes de importar. No actualizar la base en esta adopción."
  validation {
    condition     = length(trimspace(var.postgres_source_image)) > 0
    error_message = "Indicar la imagen existente; no adivinar otra versión de PostgreSQL."
  }
}

variable "postgres_mount_path" {
  type        = string
  description = "Mount path EXACTO del volumen postgres-volume existente. No se permite cambiarlo en esta adopción."
  validation {
    condition     = startswith(var.postgres_mount_path, "/") && length(var.postgres_mount_path) > 1
    error_message = "Usar la ruta absoluta que ya figura en el volumen."
  }
}

output "project_id" { value = railway_project.staging.id }
output "environment_id" { value = railway_project.staging.default_environment.id }
output "frontend_url" { value = "https://${railway_service_domain.frontend.domain}" }
output "service_ids" {
  value = merge({ for name, application in railway_service.application : name => application.id }, { Postgres = railway_service.postgres.id })
}
