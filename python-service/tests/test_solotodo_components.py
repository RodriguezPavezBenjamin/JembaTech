"""Fixtures sintéticas. Ninguna prueba accede al proveedor."""

import json
from copy import deepcopy
from email.message import Message
from unittest.mock import patch
from urllib.parse import urlsplit

import pytest
from fastapi.testclient import TestClient

from main import app
from probe_solotodo import (
    COMPONENT_TARGETS,
    ProbeError,
    fetch_component_batch,
    fetch_rows,
    sample_payload,
)
from solotodo import CpuBatch, normalize_cpu_batch
from solotodo_components import ComponentBatch, normalize_component_batch

STAMP = '2026-01-01T12:00:00Z'
RUN = '11111111-1111-4111-8111-111111111111'


def gpu(**changes):
    return {'id': 987, 'category_id': 2, 'name': '  GPU QA  ', 'brand': {'name': 'Ensamblador QA'},
            'part_number': None, 'last_updated': '2025-12-01T00:00:00Z',
            'specs': {'gpu_unicode': 'NVIDIA GPU QA', 'gpu_brand_unicode': 'NVIDIA',
                      'memory_quantity_value': 16384, 'memory_type_unicode': ' GDDR6 ',
                      'gpu_tdp': 160, 'length': 250, 'slot_type_value': 2, 'bus_unicode': 'PCI Express'},
            **changes}


def hybrid_cpu():
    return {'id': 986, 'category_id': 3, 'name': 'Intel CPU QA', 'brand': {'name': 'Intel'},
            'specs': {'socket_unicode': 'LGA 1851', 'core_count_value': 6, 'e_core_count_value': 8,
                      'total_core_count': 14, 'thread_count_value': 14, 'tdp': 125}}


def normalize(rows, category='gpu'):
    return normalize_component_batch(ComponentBatch(category=category, retrieved_at=STAMP, results=rows))


def test_gpu_units_manufacturer_chip_and_minimal_projection():
    result = normalize([gpu(description='do-not-copy', picture='do-not-copy')])
    p = result['products'][0]
    assert p['brand'] == 'Ensamblador QA'
    assert p['specs'] == {'chip': 'NVIDIA GPU QA', 'chipBrand': 'NVIDIA', 'vramGb': 16,
                          'memoryType': 'GDDR6', 'declaredTdpWatts': 160, 'lengthMm': 250,
                          'slots': 2, 'bus': 'PCI Express'}
    assert p['price_clp'] is None
    assert p['part_number'] is None
    assert p['source_updated_at'] != p['retrieved_at']
    assert 'do-not-copy' not in json.dumps(result)
    assert 'internalCatalogId' not in p
    assert result['access_status'] == 'reuse-not-confirmed'


def test_hybrid_counts_are_total_in_both_contracts():
    row = hybrid_cpu()
    p = normalize([row], 'cpu')['products'][0]
    assert p['specs']['cores'] == 14
    assert p['specs']['performanceCores'] == 6
    assert p['specs']['efficiencyCores'] == 8
    assert normalize_cpu_batch(CpuBatch(retrieved_at=STAMP, results=[row])).products[0].cores == 14
    exported = sample_payload(CpuBatch(retrieved_at=STAMP, results=[row]))
    assert exported['records'][0]['specs']['e_core_count_value'] == 8
    assert exported['records'][0]['specs']['total_core_count'] == 14
    row['specs']['total_core_count'] = 6
    assert normalize([row], 'cpu')['metrics']['rejected'] == 1


@pytest.mark.parametrize('field,value', [('memory_quantity_value', True), ('memory_quantity_value', '16384'),
                                      ('memory_quantity_value', 0), ('gpu_brand_unicode', 'Intel'),
                                      ('gpu_tdp', True), ('length', -1), ('length', '250'),
                                      ('slot_type_value', float('inf')), ('gpu_unicode', '<img>')])
def test_invalid_gpu_specs_are_rejected_per_row(field, value):
    row = gpu()
    row['specs'][field] = value
    result = normalize([row, gpu(id=988)])
    assert result['metrics']['rejected'] == 1
    assert result['metrics']['accepted'] == 1
    assert result['metrics']['valid_percent'] == 50


def test_missing_optional_fields_are_null_not_guessed_and_deduplication_is_audited():
    row = gpu()
    for field in ['gpu_tdp', 'length', 'slot_type_value', 'bus_unicode']:
        del row['specs'][field]
    result = normalize([row, row, gpu(), None])
    assert result['metrics'] == {**result['metrics'], 'received': 4, 'accepted': 1, 'duplicates': 2,
                                 'rejected': 1, 'valid_percent': 75, 'duplicate_percent': 50, 'missing_tdp': 1}
    assert result['products'][0]['specs']['lengthMm'] is None
    assert [i['code'] for i in result['issues']] == ['duplicate_id', 'conflicting_duplicate', 'invalid_record']


def test_category_isolation_and_hash_stability():
    assert normalize([gpu(category_id=3)])['metrics']['rejected'] == 1
    assert normalize([gpu(category_id=True)])['metrics']['rejected'] == 1
    assert normalize([hybrid_cpu()])['metrics']['rejected'] == 1
    row = gpu()
    first = normalize([row])['products'][0]['content_hash']
    row['picture'] = 'not copied'
    row['last_updated'] = '2025-12-02T00:00:00Z'
    assert normalize([row])['products'][0]['content_hash'] == first
    row['specs']['memory_quantity_value'] = 8192
    assert normalize([row])['products'][0]['content_hash'] != first


class FakeResponse:
    status = 200

    def __init__(self, rows):
        self.body = json.dumps({'results': rows, 'next': 'https://evil.test/ignored'}).encode()
        self.headers = Message()
        self.headers['Content-Type'] = 'application/json'

    def read(self, limit):
        return self.body[:limit]

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


def test_every_target_uses_one_literal_public_page_without_pagination():
    for target, (category, url) in COMPONENT_TARGETS.items():
        assert urlsplit(url).hostname == 'api.solotodo.com'
        assert 'page_size=5' in url and '&search=' in url
        with patch('probe_solotodo.build_opener') as opener:
            opener.return_value.open.return_value = FakeResponse([gpu()] if category == 'gpu' else [hybrid_cpu()])
            batch = fetch_component_batch(target)
            assert batch.category == category
            opener.return_value.open.assert_called_once()
            assert opener.return_value.open.call_args.args[0].full_url == url
            assert opener.return_value.open.call_args.kwargs['timeout'] == 10


@pytest.mark.parametrize('target', ['unknown', 'https://localhost/', '../cpu', '', None, True])
def test_unknown_targets_never_access_network(target):
    with patch('probe_solotodo.build_opener') as opener:
        with pytest.raises(ProbeError):
            fetch_component_batch(target)
        with pytest.raises(ProbeError):
            fetch_rows('https://localhost/private', 5)
        opener.assert_not_called()


def test_component_recovery_is_internal_bounded_and_provenanced(monkeypatch):
    client = TestClient(app)
    body = {'target': 'rx-9060xt', 'request_id': RUN}
    monkeypatch.delenv('SOLOTODO_MANUAL_PROBE_ENABLED', raising=False)
    with patch('main.fetch_component_batch') as fetch:
        assert client.post('/sources/solotodo/components/recover', json=body).status_code == 503
        monkeypatch.setenv('SOLOTODO_MANUAL_PROBE_ENABLED', 'true')
        monkeypatch.setenv('SOURCE_INTERNAL_TOKEN', 'b' * 64)
        assert client.post('/sources/solotodo/components/recover', json=body).status_code == 401
        fetch.assert_not_called()
        headers = {'X-Source-Token': 'b' * 64}
        assert client.post('/sources/solotodo/components/recover', headers=headers, json={**body, 'target': 'unknown'}).status_code == 422
        assert client.post('/sources/solotodo/components/recover', headers=headers, json={**body, 'request_id': 'invalid'}).status_code == 422
        fetch.assert_not_called()
        row = gpu(name='AMD Radeon RX 9060 XT QA')
        row['specs'].update(gpu_unicode='AMD Radeon RX 9060 XT', gpu_brand_unicode='AMD')
        fetch.return_value = ComponentBatch(category='gpu', retrieved_at=STAMP, results=[row])
        response = client.post('/sources/solotodo/components/recover', headers=headers, json=body)
        assert response.status_code == 200
        data = response.json()
        assert data['target'] == 'rx-9060xt' and data['request_id'] == RUN
        assert data['source_request_url'] == COMPONENT_TARGETS['rx-9060xt'][1]
        assert data['metrics']['accepted'] == 1
        assert 'b' * 64 not in response.text


def test_component_recovery_failures_do_not_retry(monkeypatch):
    monkeypatch.setenv('SOLOTODO_MANUAL_PROBE_ENABLED', 'true')
    monkeypatch.setenv('SOURCE_INTERNAL_TOKEN', 'b' * 64)
    with patch('main.fetch_component_batch', side_effect=ProbeError('source_access_denied')) as fetch:
        response = TestClient(app).post('/sources/solotodo/components/recover', headers={'X-Source-Token': 'b' * 64}, json={'target': 'rtx-5060', 'request_id': RUN})
        assert response.status_code == 502
        assert response.json()['detail']['code'] == 'SOURCE_ACCESS_DENIED'
        fetch.assert_called_once()


def test_component_normalize_endpoint_does_not_accept_mixed_or_oversized_batches():
    body = {'category': 'gpu', 'retrieved_at': STAMP, 'results': [gpu(), hybrid_cpu()]}
    response = TestClient(app).post('/sources/solotodo/components/normalize', json=body)
    assert response.json()['metrics']['rejected'] == 1
    body['results'] = [deepcopy(gpu()) for _ in range(6)]
    assert TestClient(app).post('/sources/solotodo/components/normalize', json=body).status_code == 422
