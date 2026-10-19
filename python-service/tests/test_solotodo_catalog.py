from copy import deepcopy
from datetime import datetime, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

import solotodo_catalog as catalog
from main import app
from probe_solotodo import ProbeError


def cpu():
    return {'id': 115591, 'category_id': 3, 'name': 'Intel Core i9-11900 [BX8070811900]', 'brand': {'name': 'Intel'}, 'part_number': 'BX8070811900', 'picture_url': 'https://media.solotodo.com/media/products/1422914_picture_1626472440.jpg', 'specs': {'socket_unicode': 'LGA 1200', 'core_count_value': 8, 'thread_count_value': 16, 'tdp': 65, 'graphics_unicode': 'UHD 750', 'cooler_unicode': 'Cooler stock Intel'}}


def test_intel_11_picture_and_socket_without_tdp_as_max_power():
    result = catalog.normalize_product(cpu(), catalog.TARGETS['cpu-intel-11'])
    assert result['id'] == 'solotodo-cpu-115591'
    assert result['image'].endswith('.jpg')
    assert result['specs']['socket'] == 'LGA1200'
    assert result['specs']['ramTypes'] == ['DDR4']
    assert result['specs']['power'] != result['specs']['declaredTdpWatts']


@pytest.mark.parametrize('name,socket', [('Intel Core i9-11900H', 'BGA 1440'), ('Intel Core i9-10900', 'LGA 1200'), ('AMD Threadripper 5955WX', 'sWRX8'), ('Intel Core i9-11900 notebook', 'LGA 1200'), ('Intel Core i9-11900', 'LGA 1700')])
def test_no_mobile_old_platform_or_server(name, socket):
    row = cpu()
    row['name'] = name
    row['specs']['socket_unicode'] = socket
    with pytest.raises(ValueError):
        catalog.normalize_product(row, catalog.TARGETS['cpu-intel-11'])


@pytest.mark.parametrize('image', [None, 'https://evil.test/p.png', 'http://media.solotodo.com/media/products/123.jpg', 'https://media.solotodo.com@evil.test/media/products/123.jpg', 'https://media.solotodo.com/media/products/../x.png', 'https://media.solotodo.com/media/products/x.svg'])
def test_only_exact_picture_host_path_and_raster(image):
    with pytest.raises(ValueError):
        catalog.picture_url(image)


def test_avif_photo_keeps_the_exact_api_url():
    image = 'https://media.solotodo.com/media/products/2769063_picture_1780064710.avif'
    assert catalog.picture_url(image) == image


def test_ram_kit_and_sodimm_exclusion():
    row = {'id': 1, 'category_id': 7, 'name': 'Kingston FURY Beast DDR5 kit', 'brand': {'name': 'Kingston'}, 'part_number': None, 'picture_url': cpu()['picture_url'], 'specs': {'bus_bus_bus_format_name': 'DIMM', 'bus_bus_bus_type_name': 'DDR5', 'capacity_total_capacity_value': 32768, 'capacity_dimm_capacity_value': 16384, 'capacity_dimm_quantity_value': 2, 'bus_frequency_value': 6000}}
    normalized = catalog.normalize_product(row, catalog.TARGETS['ram-kingston-ddr5'])
    assert normalized['specs']['modules'] == 2
    assert normalized['specs']['capacityGb'] == 32
    assert 'rgb' not in normalized['specs']  # Desconocido no se convierte en falso.
    row['specs']['bus_bus_bus_format_name'] = 'SO-DIMM'
    with pytest.raises(ValueError):
        catalog.normalize_product(row, catalog.TARGETS['ram-kingston-ddr5'])


def test_case_does_not_invent_radiator_or_psu_format():
    row = {'id': 87038, 'category_id': 10, 'name': 'Corsair 4000D AIRFLOW Black', 'brand': {'name': 'Corsair'}, 'part_number': None, 'picture_url': cpu()['picture_url'], 'specs': {'power_supply_power': 0, 'largest_motherboard_format_unicode': 'Extended ATX', 'max_video_card_length': 360, 'max_cpu_cooler_height': 170, 'internal_2_1_2_bays': 2, 'internal_3_1_2_bays': 2}}
    specs = catalog.normalize_product(row, catalog.TARGETS['case-corsair'])['specs']
    assert 'radiators' not in specs and 'psuForms' not in specs
    assert 'formatos de fuente' in specs['unverified']
    assert 'included120' not in specs and 'E-ATX' not in specs['forms']
    row['specs']['power_supply_power'] = 500
    with pytest.raises(ValueError, match='case_psu'):
        catalog.normalize_product(row, catalog.TARGETS['case-corsair'])


def test_tray_is_not_a_free_cooler_even_when_family_declares_one():
    row = cpu()
    row['name'] += ' Tray'
    result = catalog.normalize_product(row, catalog.TARGETS['cpu-intel-11'])
    assert not result['specs']['stockCooler']
    assert any('Tray/WOF' in note for note in result['specs']['unverified'])


def test_larger_candidate_page_still_bounds_offer_queries_to_five(monkeypatch):
    rows = []
    for index in range(25):
        row = cpu()
        row['id'] += index
        rows.append(row)
    urls = []

    def fetch(url):
        urls.append(url)
        return rows if '/products/' in url else []

    monkeypatch.setattr(catalog, 'fetch_json', fetch)
    result = catalog.recover_catalog('cpu-intel-11')
    assert result['schemaVersion'] == 'solotodo-catalog-3'
    assert len(urls) == 6 and urls[0].endswith('page_size=25')
    assert result['received'] == len(result['issues']) == 25
    assert sum(issue['code'] == 'candidate_limit' for issue in result['issues']) == 20


def test_empty_offers_do_not_invent_price_and_only_fetch_bounded_urls(monkeypatch):
    urls = []

    def fetch(url):
        urls.append(url)
        return [cpu()] if '/products/' in url else []

    monkeypatch.setattr(catalog, 'fetch_json', fetch)
    result = catalog.recover_catalog('cpu-intel-11')
    assert not result['products']
    assert result['issues'] == [{'index': 0, 'code': 'no_eligible_offer'}]
    assert len(urls) == 2
    assert urls[1] == 'https://publicapi.solotodo.com/entities/?products=115591&is_available=1&page_size=5'


def test_duplicate_does_not_fetch_more_offers(monkeypatch):
    row = cpu()
    now = datetime.now(timezone.utc).isoformat()
    offer = {'id': 1, 'store_id': 1, 'currency_id': 1, 'is_visible': True, 'product': {'id': 115591}, 'condition': 'https://schema.org/NewCondition', 'external_url': 'https://tienda.example.cl/producto', 'active_registry': {'entity': 1, 'is_available': True, 'timestamp': now, 'normal_price': '100000.00', 'offer_price': '99000.00'}}
    calls = []

    def fetch(url):
        calls.append(url)
        return [row, deepcopy(row)] if '/products/' in url else [offer]

    monkeypatch.setattr(catalog, 'fetch_json', fetch)
    result = catalog.recover_catalog('cpu-intel-11')
    assert len(result['products']) == 1 and len(calls) == 2
    assert result['products'][0]['prices']['offers'][0]['normalPriceClp'] == 100000


def test_rate_limit_stops_without_retry(monkeypatch):
    def blocked(url):
        raise ProbeError('source_rate_limited')
    monkeypatch.setattr(catalog, 'fetch_json', blocked)
    with pytest.raises(ProbeError, match='source_rate_limited'):
        catalog.recover_catalog('cpu-intel-11')


@pytest.mark.parametrize('url', ['http://127.0.0.1', 'https://api.solotodo.com@evil.test/products/', 'https://publicapi.solotodo.com/entities/?products=1&is_available=1&page_size=999', 'https://publicapi.solotodo.com/entities/?products=1%26url=evil&is_available=1&page_size=5'])
def test_transport_has_its_own_url_boundary(url):
    with pytest.raises(ProbeError, match='invalid_target'):
        catalog.fetch_json(url)


def test_internal_auth_disabled_and_closed_targets(monkeypatch):
    client = TestClient(app)
    payload = {'target': 'cpu-intel-11', 'request_id': str(uuid4())}
    monkeypatch.delenv('SOLOTODO_MANUAL_PROBE_ENABLED', raising=False)
    assert client.post('/sources/solotodo/catalog/recover', json=payload).status_code == 503
    monkeypatch.setenv('SOLOTODO_MANUAL_PROBE_ENABLED', 'true')
    monkeypatch.setenv('SOURCE_INTERNAL_TOKEN', 'a' * 64)
    assert client.post('/sources/solotodo/catalog/recover', json=payload).status_code == 401
    payload['target'] = 'https://127.0.0.1/private'
    assert client.post('/sources/solotodo/catalog/recover', json=payload, headers={'X-Source-Token': 'a' * 64}).status_code == 422
