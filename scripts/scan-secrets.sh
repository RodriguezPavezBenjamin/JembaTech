#!/usr/bin/env bash
set -euo pipefail
umask 077
scan_base="${SECRET_SCAN_BASE:-}"
scan_head="${SECRET_SCAN_HEAD:-$(git rev-parse HEAD)}"
if [[ "$scan_base" == 0000000000000000000000000000000000000000 ]]; then scan_base=""; fi
if [[ ! "$scan_head" =~ ^[a-f0-9]{40}$ ]] || [[ -n "$scan_base" && ! "$scan_base" =~ ^[a-f0-9]{40}$ ]]; then
  echo "Rango de escaneo inválido." >&2
  exit 1
fi
git rev-parse --verify "${scan_head}^{commit}" >/dev/null
if [[ -n "$scan_base" ]]; then git rev-parse --verify "${scan_base}^{commit}" >/dev/null; fi
scan_tmp="$(mktemp -d)"
trap 'rm -f "$scan_tmp/report.jsonl" "$scan_tmp/diagnostic.log"; rmdir "$scan_tmp"' EXIT
scan_range=(--branch "$scan_head")
if [[ -n "$scan_base" ]]; then scan_range+=(--since-commit "$scan_base"); fi
# Versión Y digest fijados; sin detector/archivo omitido ni tags de ignore.
# JSONL privado temporal: nunca subir Raw como artifact ni mostrarlo en Actions.
set +e
docker run --rm --mount "type=bind,source=$(pwd),target=/repo,readonly" \
  ghcr.io/trufflesecurity/trufflehog:3.99.2@sha256:47a84bc18a0d04a165498bbbd3bacfd84176661cbc91f8e0f85467f6a771e99a \
  git file:///repo "${scan_range[@]}" --fail --fail-on-scan-errors --no-update --no-ignore-tag \
  --json --results=verified,unknown > "$scan_tmp/report.jsonl" 2> "$scan_tmp/diagnostic.log"
scan_status=$?
set -e
node scripts/check-secrets.mjs "$scan_tmp/report.jsonl" "$scan_status"
