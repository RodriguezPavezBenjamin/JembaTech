"""Sonda manual de UNA página pública de CPU. No es una sincronización productiva."""

import argparse
import json
import sys
from datetime import datetime, timezone
from http.client import HTTPException
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener

from pydantic import ValidationError

from solotodo import CpuBatch, normalize_cpu_batch

MAX_BYTES = 1_000_000


class ProbeError(Exception):
    pass


class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def fetch_cpu_batch(limit: int):
    if isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= 5:
        raise ProbeError('invalid_limit')
    # URL fija: sin URLs arbitrarias, credenciales, paginación o redirecciones.
    url = f'https://api.solotodo.com/products/?categories=3&page_size={limit}'
    request = Request(url, headers={
        'Accept': 'application/json',
        'User-Agent': 'JembaTech-EP2-probe/0.1 (educational; single-page)',
    })
    try:
        with build_opener(NoRedirects()).open(request, timeout=10) as response:
            if response.status != 200:
                raise ProbeError('source_http_error')
            if response.headers.get_content_type() != 'application/json':
                raise ProbeError('unexpected_content_type')
            body = response.read(MAX_BYTES + 1)
            if len(body) > MAX_BYTES:
                raise ProbeError('response_too_large')
    except HTTPError as error:
        error.close()
        if error.code == 429:
            raise ProbeError('source_rate_limited') from error
        if error.code in (401, 403):
            raise ProbeError('source_access_denied') from error
        raise ProbeError('source_http_error') from error
    except (URLError, TimeoutError, OSError, HTTPException) as error:
        raise ProbeError('source_unavailable') from error
    try:
        payload = json.loads(body)
        rows = payload.get('results') if isinstance(payload, dict) else None
        if not isinstance(rows, list) or len(rows) > limit:
            raise ProbeError('invalid_source_contract')
        batch = CpuBatch(
            retrieved_at=datetime.now(timezone.utc), results=rows,
        )
    except (ValueError, ValidationError) as error:
        raise ProbeError('invalid_source_contract') from error
    return batch


def probe(limit: int):
    return normalize_cpu_batch(fetch_cpu_batch(limit))


def sample_payload(batch: CpuBatch):
    # Exportar solo el contrato mínimo, no fotos, descripciones o plantillas.
    rows = []
    for row in batch.results:
        if not isinstance(row, dict):
            rows.append(row)
            continue
        record = {k: row.get(k) for k in ['id', 'category_id', 'name', 'part_number', 'last_updated']}
        brand = row.get('brand')
        record['brand'] = {'name': brand.get('name')} if isinstance(brand, dict) else brand
        specs = row.get('specs')
        record['specs'] = {k: specs.get(k) for k in ['socket_unicode', 'core_count_value', 'thread_count_value', 'tdp']} if isinstance(specs, dict) else specs
        rows.append(record)
    return {'retrievedAt': batch.retrieved_at.isoformat(), 'records': rows}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--live', action='store_true', help='Autoriza esta sonda manual; no acredita permiso de reutilización.')
    parser.add_argument('--limit', type=int, choices=range(1, 6), default=1)
    parser.add_argument('--batch', action='store_true', help='Exporta muestra mínima para validar desde el panel admin; no guarda archivos.')
    args = parser.parse_args()
    if not args.live:
        parser.error('Sin red por defecto. Revisa docs/entrega-2.md antes de usar --live.')
    try:
        if args.batch:
            print(json.dumps(sample_payload(fetch_cpu_batch(args.limit)), ensure_ascii=False, indent=2))
            return 0
        result = probe(args.limit)
    except ProbeError as error:
        print(json.dumps({'status': 'error', 'code': str(error)}), file=sys.stderr)
        return 1
    print(result.model_dump_json(indent=2))
    return 0


if __name__ == '__main__':
    sys.exit(main())
