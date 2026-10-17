#!/usr/bin/env bash
# Escanea los IDs construidos/ejecutados, no un tag de registro ajeno al build.
set -euo pipefail
mkdir -p reports
status=0
for service in frontend backend python-service migrate database; do
  image_id="$(docker compose images -q "$service")"
  if [[ -z "$image_id" || "$image_id" == *$'\n'* ]]; then
    echo "No hay una imagen inequívoca para $service" >&2
    status=1
    continue
  fi
  # Informe completo, también de CVE sin parche. Un fallo del escáner no es éxito.
  if ! trivy image --scanners vuln --timeout 10m --format json \
      --output "reports/trivy-$service.json" --exit-code 0 "$image_id"; then
    status=1
    continue
  fi
  # Cualquier CRITICAL bloquea, también sin parche. Sin excepciones por CVE.
  if ! trivy image --scanners vuln --timeout 10m --severity CRITICAL \
      --format json --output "reports/trivy-$service-critical-gate.json" \
      --exit-code 1 "$image_id"; then
    status=1
  fi
  # HIGH con solución disponible; los demás siguen en el informe completo.
  if ! trivy image --scanners vuln --timeout 10m --severity HIGH \
      --ignore-unfixed --format json --output "reports/trivy-$service-gate.json" \
      --exit-code 1 "$image_id"; then
    status=1
  fi
done
exit "$status"
