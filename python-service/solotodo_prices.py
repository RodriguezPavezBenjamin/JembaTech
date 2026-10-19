"""Ofertas puntuales para SKU revisados; no precios mínimos de todo el mercado."""

import json
import re
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from http.client import HTTPException
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, build_opener

from probe_solotodo import MAX_BYTES, NoRedirects, ProbeError

# ID y presentación revisados contra la ficha pública; nunca elegir por similitud.
PRICE_TARGETS = {
    'cpu-7600': (166287, 'https://publicapi.solotodo.com/entities/?products=166287&is_available=1&page_size=5'),
    'gpu-4060': (211481, 'https://publicapi.solotodo.com/entities/?products=211481&is_available=1&page_size=5'),
    'board-msi-b550-a-pro': (85687, 'https://publicapi.solotodo.com/entities/?products=85687&is_available=1&page_size=5'),
    'ram-kingston-ddr4-rgb-16': (118735, 'https://publicapi.solotodo.com/entities/?products=118735&is_available=1&page_size=5'),
    'drive-kingston-a400-480': (33675, 'https://publicapi.solotodo.com/entities/?products=33675&is_available=1&page_size=5'),
    'drive-samsung-990-pro-1000': (157430, 'https://publicapi.solotodo.com/entities/?products=157430&is_available=1&page_size=5'),
    'cpu-9600x': (252401, 'https://publicapi.solotodo.com/entities/?products=252401&is_available=1&page_size=5'),
    'gpu-asrock-9060xt-16': (278239, 'https://publicapi.solotodo.com/entities/?products=278239&is_available=1&page_size=5'),
}


def money(value):
    if not isinstance(value, str) or not re.fullmatch(r'[0-9]{1,8}(?:\.00)?', value):
        raise ValueError('Precio CLP no entero')
    amount = int(Decimal(value))
    if not 0 < amount <= 100_000_000:
        raise ValueError('Precio fuera de rango')
    return amount


def safe_offer_url(value):
    if not isinstance(value, str) or len(value) > 2000 or any(ord(c) < 33 for c in value) or '\\' in value:
        raise ValueError('URL inválida')
    url = urlsplit(value)
    host = url.hostname or ''
    if (url.scheme != 'https' or url.username or url.password or url.port not in (None, 443)
            or not re.fullmatch(r'[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,63}', host)
            or host.endswith(('.local', '.localhost', '.invalid', '.internal'))):
        raise ValueError('URL no pública HTTPS')
    return host


def normalize_offers(rows, product_id, retrieved_at):
    offers, issues, seen = [], [], set()
    for index, row in enumerate(rows):
        try:
            if not isinstance(row, dict):
                raise TypeError('Oferta inválida')
            registry = row.get('active_registry')
            product = row.get('product')
            if not isinstance(registry, dict) or not isinstance(product, dict):
                raise TypeError('Registro inválido')
            if (type(product.get('id')) is not int or product['id'] != product_id
                    or type(row.get('id')) is not int or row['id'] <= 0
                    or type(row.get('store_id')) is not int or row['store_id'] <= 0
                    or type(row.get('currency_id')) is not int or row['currency_id'] != 1
                    or row.get('is_visible') is not True or registry.get('is_available') is not True
                    or type(registry.get('entity')) is not int or registry.get('entity') != row['id']
                    or row.get('condition') != 'https://schema.org/NewCondition'
                    or row.get('bundle') is not None or row.get('cell_plan') is not None
                    or row.get('best_coupon') is not None or registry.get('cell_monthly_payment') is not None):
                raise ValueError('Identidad, CLP, disponibilidad o condiciones no aptas')
            stamp = registry.get('timestamp')
            if not isinstance(stamp, str) or not re.search(r'(Z|[+-]\d{2}:\d{2})$', stamp):
                raise ValueError('Fecha sin zona')
            updated = datetime.fromisoformat(stamp.replace('Z', '+00:00'))
            if not retrieved_at - timedelta(hours=24) <= updated <= retrieved_at + timedelta(minutes=5):
                raise ValueError('Oferta antigua o futura')
            normal, offer = money(registry.get('normal_price')), money(registry.get('offer_price'))
            if offer > normal:
                raise ValueError('Precios contradictorios')
            host = safe_offer_url(row.get('external_url'))
            if row['id'] in seen:
                raise ValueError('Oferta repetida')
            seen.add(row['id'])
            offers.append({'entityId': row['id'], 'productId': product_id, 'storeId': row['store_id'],
                           'available': True, 'condition': 'new', 'currency': 'CLP', 'conditional': False,
                           'storeHost': host, 'offerUrl': row['external_url'], 'normalPriceClp': normal,
                           'offerPriceClp': offer, 'sourceUpdatedAt': updated.isoformat()})
        except (ValueError, TypeError, OverflowError):
            issues.append({'index': index, 'code': 'ineligible_offer'})
    return {'offers': offers, 'issues': issues, 'received': len(rows), 'rejected': len(issues)}


def recover_prices(target):
    if target not in PRICE_TARGETS:
        raise ProbeError('invalid_target')
    product_id, url = PRICE_TARGETS[target]
    request = Request(url, headers={'Accept': 'application/json', 'User-Agent': 'JembaTech-EP2-probe/0.1 (educational; single-page)'})
    try:
        with build_opener(NoRedirects()).open(request, timeout=10) as response:
            if response.status != 200 or response.headers.get_content_type() != 'application/json':
                raise ProbeError('invalid_source_contract')
            body = response.read(MAX_BYTES + 1)
            if len(body) > MAX_BYTES:
                raise ProbeError('response_too_large')
    except HTTPError as error:
        error.close()
        code = 'source_rate_limited' if error.code == 429 else 'source_access_denied' if error.code in (401, 403) else 'source_http_error'
        raise ProbeError(code) from error
    except (URLError, TimeoutError, OSError, HTTPException) as error:
        raise ProbeError('source_unavailable') from error
    try:
        data = json.loads(body)
        rows = data.get('results') if isinstance(data, dict) else None
        if not isinstance(rows, list) or len(rows) > 5:
            raise ValueError('Página inválida')
    except (ValueError, TypeError) as error:
        raise ProbeError('invalid_source_contract') from error
    now = datetime.now(timezone.utc)
    return {'schemaVersion': 'solotodo-prices-1', 'target': target, 'productId': product_id,
            'sourceRequestUrl': url, 'retrievedAt': now.isoformat(), 'currency': 'CLP',
            'scope': 'first-page', **normalize_offers(rows, product_id, now)}
