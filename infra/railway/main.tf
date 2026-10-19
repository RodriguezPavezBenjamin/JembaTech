terraform {
  required_version = ">= 1.7.0"
  # La adopción real exige configurar path y workspace_dir en almacenamiento
  # privado durante init; nunca usar el estado predeterminado del repositorio.
  backend "local" {}
  required_providers {
    railway = {
      source  = "terraform-community-providers/railway"
      version = "0.6.2"
    }
  }
}

# Proveedor comunitario, no oficial de Railway. Credencial solo por RAILWAY_TOKEN.
provider "railway" {}

resource "railway_project" "staging" {
  name                = "JembaTech Staging"
  private             = true
  has_pr_deploys      = false
  default_environment = { name = "staging" }
  lifecycle {
    prevent_destroy = true
  }
}

locals {
  applications = toset(["python-service", "backend", "frontend"])
  # No se gestionan JWT_SECRET, claves Firebase, contraseñas o datos de clientes.
  settings = {
    "python-service.PORT"                          = "8000"
    "python-service.SOLOTODO_MANUAL_PROBE_ENABLED" = "false"
    "backend.PORT"                                 = "3000"
    "backend.NODE_ENV"                             = "production"
    "backend.DATABASE_URL"                         = "$${{Postgres.DATABASE_URL}}"
    "backend.PYTHON_SERVICE_URL"                   = "http://$${{python-service.RAILWAY_PRIVATE_DOMAIN}}:$${{python-service.PORT}}"
    "backend.SOLOTODO_MANUAL_PROBE_ENABLED"        = "false"
    "frontend.PORT"                                = "80"
    "frontend.BACKEND_HOST"                        = "$${{backend.RAILWAY_PRIVATE_DOMAIN}}"
    "frontend.BACKEND_PORT"                        = "$${{backend.PORT}}"
  }
}

resource "railway_service" "application" {
  for_each           = local.applications
  project_id         = railway_project.staging.id
  name               = each.key
  source_repo        = "RodriguezPavezBenjamin/JembaTech"
  source_repo_branch = "main"
  root_directory     = "/${each.key}"
  lifecycle {
    prevent_destroy = true
  }
}

resource "railway_service" "postgres" {
  project_id   = railway_project.staging.id
  name         = "Postgres"
  source_image = var.postgres_source_image
  volume = {
    name       = "postgres-volume"
    mount_path = var.postgres_mount_path
  }
  lifecycle {
    prevent_destroy = true
    # El proveedor puede borrar/desmontar volúmenes desde Update: proteger también
    # esos cambios internos, no solamente la eliminación completa del servicio.
    ignore_changes = [volume, source_image]
  }
}

resource "railway_variable" "setting" {
  for_each       = local.settings
  environment_id = railway_project.staging.default_environment.id
  service_id     = railway_service.application[split(".", each.key)[0]].id
  name           = split(".", each.key)[1]
  value          = each.value
  lifecycle {
    prevent_destroy = true
  }
}

resource "railway_service_domain" "frontend" {
  service_id     = railway_service.application["frontend"].id
  environment_id = railway_project.staging.default_environment.id
  subdomain      = "jembatech"
  lifecycle {
    prevent_destroy = true
  }
}
