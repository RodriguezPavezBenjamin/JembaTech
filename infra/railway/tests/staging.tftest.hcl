# Prueba de diseño SIN API ni recursos facturables; no acredita un plan cloud real.
mock_provider "railway" {}

variables {
  postgres_source_image = "postgres:16-alpine"
  postgres_mount_path   = "/var/lib/postgresql/data"
}

run "resource_contract" {
  command = plan
  assert {
    condition     = length(railway_service.application) == 3 && railway_service.postgres.name == "Postgres"
    error_message = "El diseño debe conservar los cuatro servicios separados."
  }
  assert {
    condition     = railway_service.application["backend"].root_directory == "/backend"
    error_message = "Backend debe construirse desde su directorio del monorepo."
  }
  assert {
    condition     = railway_service.postgres.volume.mount_path == var.postgres_mount_path
    error_message = "El volumen debe tener la ruta declarada y conservarse en adopción."
  }
  assert {
    condition     = railway_variable.setting["backend.DATABASE_URL"].value == "$${{Postgres.DATABASE_URL}}"
    error_message = "La conexión debe ser una referencia, no una credencial copiada."
  }
  assert {
    condition     = railway_service_domain.frontend.subdomain == "jembatech"
    error_message = "Solo se gestiona el dominio público del frontend."
  }
}
