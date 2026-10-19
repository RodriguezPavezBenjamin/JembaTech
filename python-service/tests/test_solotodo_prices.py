"""Ofertas sintéticas: no accede al proveedor durante las pruebas."""
from copy import deepcopy
from datetime import datetime, timezone
from io import BytesIO
from secrets import token_hex
from unittest.mock import patch
from urllib.parse import urlunsplit

import pytest
from fastapi.testclient import TestClient

from main import app
from probe_solotodo import ProbeError
from solotodo_prices import (
    PRICE_TARGETS,
    money,
    normalize_offers,
    recover_prices,
    safe_offer_url,
)

NOW = datetime(2026, 10, 18, 12, tzinfo=timezone.utc)


def offer_url_with_credentials():
    # Dato negativo efímero: nunca es una credencial de un servicio real.
    return urlunsplit(('https', f'qa:{token_hex(16)}@tienda.example.cl', '/producto/qa', '', ''))


def offer():
    return {'id': 123, 'product': {'id': 166287}, 'store_id': 12, 'currency_id': 1,
            'external_url': 'https://tienda.example.cl/producto/qa', 'condition': 'https://schema.org/NewCondition',
            'is_visible': True, 'bundle': None, 'cell_plan': None, 'best_coupon': None,
            'active_registry': {'entity': 123, 'timestamp': NOW.isoformat(), 'is_available': True,
                                'normal_price': '210000.00', 'offer_price': '200000.00', 'cell_monthly_payment': None}}


def test_exact_product_clp_and_date_with_no_photos_or_descriptions():
    row = offer()
    row.update(description='never copy', picture_urls=['https://example.invalid/image'])
    result = normalize_offers([row], 166287, NOW)
    assert result['rejected'] == 0
    price = result['offers'][0]
    assert price['normalPriceClp'] == 210000 and price['offerPriceClp'] == 200000
    assert price['currency'] == 'CLP' and price['available'] is True
    assert price['storeHost'] == 'tienda.example.cl'
    assert 'never copy' not in str(result) and 'picture' not in str(result)


@pytest.mark.parametrize('field,value', [
    ('product', {'id': 151869}), ('currency_id', 2), ('currency_id', True),
    ('store_id', True), ('is_visible', False), ('condition', 'https://schema.org/UsedCondition'),
    ('bundle', {'id': 1}), ('cell_plan', {'id': 1}), ('best_coupon', {'discount': 20}),
    ('external_url', 'http://127.0.0.1/x'), ('external_url', offer_url_with_credentials()),
])
def test_ineligible_rows_never_supply_a_price(field, value):
    row = offer(); row[field] = value
    assert normalize_offers([row], 166287, NOW)['offers'] == []


@pytest.mark.parametrize('field,value', [
    ('is_available', False), ('is_available', 1), ('entity', True), ('normal_price', '0.00'),
    ('normal_price', '100.99'), ('normal_price', True), ('offer_price', '999999.00'),
    ('timestamp', '2026-10-16T12:00:00Z'), ('timestamp', '2026-10-19T12:00:00Z'),
    ('timestamp', '2026-10-18T12:00:00'), ('cell_monthly_payment', 1),
])
def test_old_unavailable_conditional_or_invalid_prices_are_rejected(field, value):
    row = offer(); row['active_registry'][field] = value
    result = normalize_offers([row], 166287, NOW)
    assert result['rejected'] == 1 and result['offers'] == []


def test_ephemeral_credentials_are_rejected_without_changing_the_valid_host():
    assert safe_offer_url(offer()['external_url']) == 'tienda.example.cl'
    with pytest.raises(ValueError, match='URL no pública HTTPS'):
        safe_offer_url(offer_url_with_credentials())


def test_duplicates_and_empty_page_are_explicit():
    assert normalize_offers([], 166287, NOW) == {'offers': [], 'issues': [], 'received': 0, 'rejected': 0}
    result = normalize_offers([offer(), deepcopy(offer())], 166287, NOW)
    assert result['received'] == 2 and len(result['offers']) == 1 and result['rejected'] == 1
    assert money('1234.00') == 1234
    with pytest.raises(ValueError):
        safe_offer_url('https://example.local/path')


def test_eight_closed_targets_and_unknown_target_never_opens_network():
    with patch('solotodo_prices.build_opener') as network:
        with pytest.raises(ProbeError):
            recover_prices('https://localhost/')
        network.assert_not_called()
    assert len(PRICE_TARGETS) == 8


def test_fetch_is_bounded_no_next_followed_and_auth_is_required(monkeypatch):
    client = TestClient(app)
    monkeypatch.setenv('SOLOTODO_MANUAL_PROBE_ENABLED', 'false')
    assert client.post('/sources/solotodo/prices/recover', json={'target': 'cpu-7600', 'request_id': '11111111-1111-4111-8111-111111111111'}).status_code == 503
    monkeypatch.setenv('SOLOTODO_MANUAL_PROBE_ENABLED', 'true')
    monkeypatch.setenv('SOURCE_INTERNAL_TOKEN', 'a' * 64)
    assert client.post('/sources/solotodo/prices/recover', json={'target': 'cpu-7600', 'request_id': '11111111-1111-4111-8111-111111111111'}).status_code == 401
    response = BytesIO(b'{"results":[],"next":"https://example.invalid/private"}')
    response.status = 200
    response.headers = type('Headers', (), {'get_content_type': lambda _: 'application/json'})()
    with patch('solotodo_prices.build_opener') as network:
        network.return_value.open.return_value = response
        result = recover_prices('cpu-7600')
        assert result['offers'] == [] and result['received'] == 0
        network.return_value.open.assert_called_once()
