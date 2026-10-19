"""Sonda manual de UNA página pública de CPU. No es una sincronización productiva."""

import argparse
import json
import sys
from datetime import datetime, timezone
from http.client import HTTPException
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from pydantic import ValidationError

from solotodo import CpuBatch, normalize_cpu_batch
from solotodo_components import ComponentBatch

MAX_BYTES = 1_000_000
CPU_PAGE_URLS = {
    1: 'https://api.solotodo.com/products/?categories=3&page_size=1',
    2: 'https://api.solotodo.com/products/?categories=3&page_size=2',
    3: 'https://api.solotodo.com/products/?categories=3&page_size=3',
    4: 'https://api.solotodo.com/products/?categories=3&page_size=4',
    5: 'https://api.solotodo.com/products/?categories=3&page_size=5',
}

# Destinos literales: el cliente elige una clave, nunca una URL ni filtros libres.
COMPONENT_TARGETS = {
    'ryzen-7600': ('cpu', 'https://api.solotodo.com/products/?categories=3&search=Ryzen%205%207600&page_size=5'),
    'ryzen-9600x': ('cpu', 'https://api.solotodo.com/products/?categories=3&search=Ryzen%205%209600X&page_size=5'),
    'core-i5-14400': ('cpu', 'https://api.solotodo.com/products/?categories=3&search=Core%20i5%2014400&page_size=5'),
    'core-ultra-245k': ('cpu', 'https://api.solotodo.com/products/?categories=3&search=Core%20Ultra%205%20245K&page_size=5'),
    'rtx-4060': ('gpu', 'https://api.solotodo.com/products/?categories=2&search=RTX%204060&page_size=5'),
    'rtx-5060': ('gpu', 'https://api.solotodo.com/products/?categories=2&search=RTX%205060&page_size=5'),
    'rx-7600': ('gpu', 'https://api.solotodo.com/products/?categories=2&search=RX%207600&page_size=5'),
    'rx-9060xt': ('gpu', 'https://api.solotodo.com/products/?categories=2&search=RX%209060%20XT&page_size=5'),
    'msi-b650': ('motherboard', 'https://api.solotodo.com/products/?categories=5&search=MSI%20B650&page_size=5'),
    'msi-b760': ('motherboard', 'https://api.solotodo.com/products/?categories=5&search=MSI%20B760&page_size=5'),
    'fury-ddr4': ('ram', 'https://api.solotodo.com/products/?categories=7&search=Kingston%20FURY%20Beast%20DDR4&page_size=5'),
    'fury-ddr5': ('ram', 'https://api.solotodo.com/products/?categories=7&search=Kingston%20FURY%20Beast%20DDR5&page_size=5'),
    'barracuda-hdd': ('storage', 'https://api.solotodo.com/products/?categories=8&search=Seagate%20Barracuda&page_size=5'),
    'mx500-sata': ('storage', 'https://api.solotodo.com/products/?categories=39&search=Crucial%20MX500&page_size=5'),
    'nv3-pcie': ('storage', 'https://api.solotodo.com/products/?categories=39&search=Kingston%20NV3&page_size=5'),
    'ryzen-5600': ('cpu', 'https://api.solotodo.com/products/?categories=3&search=Ryzen%205%205600&page_size=5'),
    'ryzen-5600g': ('cpu', 'https://api.solotodo.com/products/?categories=3&search=Ryzen%205%205600G&page_size=5'),
    'ryzen-7800x3d': ('cpu', 'https://api.solotodo.com/products/?categories=3&search=Ryzen%207%207800X3D&page_size=5'),
    'msi-b550-a-pro': ('motherboard', 'https://api.solotodo.com/products/?categories=5&search=MSI%20B550-A%20PRO&page_size=5'),
    'msi-4060-ventus': ('gpu', 'https://api.solotodo.com/products/?categories=2&search=MSI%20RTX%204060%20Ventus%202X%20Black%208G%20OC&page_size=5'),
    'fury-rgb-ddr4-kit': ('ram', 'https://api.solotodo.com/products/?categories=7&search=KF432C16BBAK2%2F16&page_size=5'),
    'a400-480-sata': ('storage', 'https://api.solotodo.com/products/?categories=39&search=SA400S37%2F480G&page_size=5'),
    '990-pro-1tb': ('storage', 'https://api.solotodo.com/products/?categories=39&search=MZ-V9P1T0&page_size=5'),
}


def target_terms(target: str):
    return tuple(parse_qs(urlsplit(COMPONENT_TARGETS[target][1]).query)['search'][0].split())


def target_category_id(target: str):
    return int(parse_qs(urlsplit(COMPONENT_TARGETS[target][1]).query)['categories'][0])


class ProbeError(Exception):
    pass


class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def fetch_cpu_batch(limit: int):
    if isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= 5:
        raise ProbeError('invalid_limit')
    # Seleccionar una URL literal autorizada; no interpolar entradas en la petición.
    url = CPU_PAGE_URLS[limit]
    rows = fetch_rows(url, limit)
    return CpuBatch(retrieved_at=datetime.now(timezone.utc), results=rows)


def fetch_component_batch(target: str):
    if not isinstance(target, str) or target not in COMPONENT_TARGETS:
        raise ProbeError('invalid_target')
    category, url = COMPONENT_TARGETS[target]
    rows = fetch_rows(url, 5)
    return ComponentBatch(category=category, retrieved_at=datetime.now(timezone.utc), results=rows)


def fetch_rows(url: str, limit: int):
    # Defensa adicional incluso si otro llamador intenta saltarse las selecciones.
    if url not in {*CPU_PAGE_URLS.values(), *(item[1] for item in COMPONENT_TARGETS.values())}:
        raise ProbeError('invalid_target')
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
    except (ValueError, ValidationError) as error:
        raise ProbeError('invalid_source_contract') from error
    return rows


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
        if isinstance(specs, dict):
            for key in ['e_core_count_value', 'total_core_count']:
                if key in specs:
                    record['specs'][key] = specs[key]
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
