"""Fixtures sintéticas con la estructura observada; CI nunca consulta SoloTodo."""

import json
from copy import deepcopy
from datetime import datetime, timezone
from email.message import Message
from io import BytesIO
from unittest.mock import patch
from urllib.error import HTTPError, URLError

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

from main import CpuRecoveryRequest, app, recover_solotodo_cpu
from probe_solotodo import (
    MAX_BYTES,
    NoRedirects,
    ProbeError,
    main,
    probe,
    sample_payload,
)
from solotodo import CpuBatch, normalize_cpu_batch

STAMP = '2026-01-01T12:00:00Z'


def cpu(**changes):
    return {
        'id': 123, 'category_id': 3, 'name': '  AMD\tRyzen 5 5600 ',
        'brand': {'id': 317, 'name': ' AMD '}, 'part_number': ' 100-TEST ',
        'last_updated': '2025-12-01T00:00:00Z',
        'specs': {
            'socket_unicode': ' AM4 ', 'core_count_value': 6,
            'thread_count_value': 12, 'tdp': 65,
        }, **changes,
    }


def normalize(rows):
    return normalize_cpu_batch(CpuBatch(retrieved_at=STAMP, results=rows))


def test_cpu_cleaning_provenance_and_no_invented_prices():
    result = normalize([cpu(description='<script>no copiar</script>', picture_url='https://invalid.test/a.png')])
    product = result.products[0]
    assert product.name == 'AMD Ryzen 5 5600'
    assert product.brand == 'AMD'
    assert product.socket == 'AM4'
    assert product.part_number == '100-TEST'
    assert product.source_url == 'https://www.solotodo.cl/products/123'
    assert product.retrieved_at == datetime(2026, 1, 1, 12, tzinfo=timezone.utc)
    assert product.source_updated_at != product.retrieved_at
    assert product.declared_tdp_watts == 65
    assert product.price_clp is None
    assert len(product.content_hash) == 64
    assert 'description' not in product.model_dump()
    assert 'picture_url' not in product.model_dump()
    assert result.access_status == 'reuse-not-confirmed'


@pytest.mark.parametrize('changes', [
    {'id': True}, {'id': -1}, {'id': '123'}, {'name': '   '},
    {'name': '<b>CPU</b>'}, {'category_id': 549}, {'category_id': '3'},
    {'brand': None}, {'last_updated': '2026-01-01T00:00:00'},
    {'last_updated': '2099-01-01T00:00:00Z'}, {'specs': None},
])
def test_invalid_rows_are_isolated(changes):
    result = normalize([cpu(**changes), cpu(id=456)])
    assert result.metrics.received == 2
    assert result.metrics.rejected == 1
    assert result.metrics.accepted == 1
    assert result.metrics.valid_percent == 50
    assert result.products[0].external_id == '456'
    assert result.issues[0].code == 'invalid_record'


@pytest.mark.parametrize('changes', [
    {'core_count_value': True}, {'thread_count_value': 1},
    {'core_count_value': 0}, {'tdp': -1}, {'tdp': True},
    {'tdp': '65 W'}, {'tdp': float('inf')}, {'tdp': float('nan')},
])
def test_invalid_specifications_are_not_guessed(changes):
    row = cpu()
    row['specs'].update(changes)
    assert normalize([row]).metrics.rejected == 1


def test_duplicate_identity_and_conflicts_keep_first_valid_record():
    result = normalize([cpu(), cpu(), cpu(name='Otro modelo'), cpu(id=456)])
    assert [p.external_id for p in result.products] == ['123', '456']
    assert result.metrics.duplicates == 2
    assert result.metrics.valid_percent == 100
    assert result.metrics.duplicate_percent == 50
    assert [i.code for i in result.issues] == ['duplicate_id', 'conflicting_duplicate']
    assert result.metrics.received == result.metrics.accepted + result.metrics.rejected + result.metrics.duplicates


def test_content_hash_is_stable_across_retrievals_and_ignored_fields():
    first = normalize([cpu()]).products[0]
    row = cpu(description='Texto diferente', slug='otro-slug')
    second = normalize_cpu_batch(CpuBatch(retrieved_at='2026-02-01T00:00:00Z', results=[row])).products[0]
    assert first.content_hash == second.content_hash
    changed = cpu()
    changed['specs']['tdp'] = 95
    assert first.content_hash != normalize([changed]).products[0].content_hash


def test_missing_tdp_and_part_number_remain_unknown():
    row = cpu(part_number=None)
    del row['specs']['tdp']
    result = normalize([row])
    assert result.metrics.missing_tdp == 1
    assert result.products[0].declared_tdp_watts is None
    assert result.products[0].part_number is None


def test_empty_and_malformed_rows_do_not_crash_or_expose_input():
    empty = normalize([])
    assert empty.metrics.valid_percent == empty.metrics.duplicate_percent == 0
    result = normalize([None, [], 'private-value'])
    assert result.metrics.rejected == 3
    assert 'private-value' not in result.model_dump_json()


@pytest.mark.parametrize('stamp', ['2026-01-01T00:00:00', '2099-01-01T00:00:00Z'])
def test_batch_requires_non_future_timezone_aware_timestamp(stamp):
    with pytest.raises(ValidationError):
        CpuBatch(retrieved_at=stamp, results=[])


def test_fastapi_contract_and_batch_limit():
    client = TestClient(app)
    response = client.post('/sources/solotodo/cpu/normalize', json={'retrieved_at': STAMP, 'results': [cpu()]})
    assert response.status_code == 200
    assert response.json()['metrics']['accepted'] == 1
    assert client.post('/sources/solotodo/cpu/normalize', json={'retrieved_at': STAMP, 'results': [cpu()] * 51}).status_code == 422
    assert client.post('/sources/solotodo/cpu/normalize', json={'retrieved_at': STAMP, 'results': [], 'url': 'http://localhost'}).status_code == 422


class FakeResponse(BytesIO):
    status = 200

    def __init__(self, content, content_type='application/json'):
        super().__init__(content)
        self.headers = Message()
        self.headers['Content-Type'] = content_type


@pytest.mark.parametrize('limit', [1, 2, 3, 4, 5])
def test_probe_fetches_only_one_fixed_page_and_never_follows_next(limit):
    payload = {'results': [cpu()], 'next': 'http://127.0.0.1/private'}
    with patch('probe_solotodo.build_opener') as opener:
        opener.return_value.open.return_value = FakeResponse(json.dumps(payload).encode())
        result = probe(limit)
        assert result.metrics.accepted == 1
        opener.return_value.open.assert_called_once()
        request = opener.return_value.open.call_args.args[0]
        assert request.full_url == f'https://api.solotodo.com/products/?categories=3&page_size={limit}'
        assert opener.return_value.open.call_args.kwargs['timeout'] == 10


@pytest.mark.parametrize(('error', 'code'), [
    (URLError('secret details'), 'source_unavailable'),
    (TimeoutError(), 'source_unavailable'),
    (HTTPError('url', 429, 'Too many', {}, None), 'source_rate_limited'),
    (HTTPError('url', 403, 'Denied', {}, None), 'source_access_denied'),
    (HTTPError('url', 302, 'Redirect', {}, None), 'source_http_error'),
    (HTTPError('url', 500, 'Server', {}, None), 'source_http_error'),
])
def test_probe_stops_on_errors_without_retries(error, code):
    with patch('probe_solotodo.build_opener') as opener:
        opener.return_value.open.side_effect = error
        with pytest.raises(ProbeError, match=code):
            probe(1)
        opener.return_value.open.assert_called_once()


@pytest.mark.parametrize(('body', 'content_type', 'code'), [
    (b'<html>error</html>', 'text/html', 'unexpected_content_type'),
    (b'not-json', 'application/json', 'invalid_source_contract'),
    (b'{"results":{}}', 'application/json', 'invalid_source_contract'),
    (b'{}', 'application/json', 'invalid_source_contract'),
    (json.dumps({'results': [cpu(), cpu()]}).encode(), 'application/json', 'invalid_source_contract'),
    (b'x' * (MAX_BYTES + 1), 'application/json', 'response_too_large'),
])
def test_probe_validates_and_bounds_the_response(body, content_type, code):
    with patch('probe_solotodo.build_opener') as opener:
        opener.return_value.open.return_value = FakeResponse(body, content_type)
        with pytest.raises(ProbeError, match=code):
            probe(1)


@pytest.mark.parametrize('limit', [0, 6, True, False, '1', 1.0, None, -1, 'https://localhost', '1&next=http://localhost', '1\r\nHost: localhost'])
def test_probe_rejects_invalid_limits_before_network(limit):
    with patch('probe_solotodo.build_opener') as opener:
        with pytest.raises(ProbeError, match='invalid_limit'):
            probe(limit)
        opener.assert_not_called()


def test_probe_requires_explicit_live_flag_and_disables_redirects():
    with patch('sys.argv', ['probe_solotodo.py']), patch('probe_solotodo.probe') as live_probe:
        with pytest.raises(SystemExit) as error:
            main()
        assert error.value.code == 2
        live_probe.assert_not_called()
    assert NoRedirects().redirect_request(None, None, 302, '', {}, 'http://localhost') is None


def test_timezone_is_normalized_and_bad_first_row_does_not_reserve_id():
    bad = deepcopy(cpu())
    bad['name'] = ''
    result = normalize_cpu_batch(CpuBatch(retrieved_at='2026-01-01T09:00:00-03:00', results=[bad, cpu()]))
    assert result.metrics.accepted == 1
    assert result.metrics.duplicates == 0
    assert result.products[0].retrieved_at.isoformat() == '2026-01-01T12:00:00+00:00'


def test_export_for_admin_excludes_pictures_and_descriptions():
    batch = CpuBatch(retrieved_at=STAMP, results=[cpu(description='Do not copy', picture_url='https://example.test/photo')])
    exported = sample_payload(batch)
    assert exported['retrievedAt'] == '2026-01-01T12:00:00+00:00'
    assert exported['records'][0]['specs']['core_count_value'] == 6
    assert 'description' not in exported['records'][0]
    assert 'picture_url' not in exported['records'][0]
    assert 'id' not in exported['records'][0]['brand']


def test_integrated_recovery_is_disabled_by_default(monkeypatch):
    monkeypatch.delenv('SOLOTODO_MANUAL_PROBE_ENABLED', raising=False)
    with patch('main.fetch_cpu_batch') as fetch:
        response = TestClient(app).post('/sources/solotodo/cpu/recover', json={'limit': 1, 'request_id': '11111111-1111-4111-8111-111111111111'})
        assert response.status_code == 503
        fetch.assert_not_called()


@pytest.mark.parametrize('token', ['', 'wrong', 'é'])
def test_integrated_recovery_requires_internal_auth(monkeypatch, token):
    monkeypatch.setenv('SOLOTODO_MANUAL_PROBE_ENABLED', 'true')
    monkeypatch.setenv('SOURCE_INTERNAL_TOKEN', 'b' * 64)
    with patch('main.fetch_cpu_batch') as fetch:
        # ASGI permite verificar también un valor malformado sin hacer red externa.
        with pytest.raises(HTTPException) as error:
            recover_solotodo_cpu(CpuRecoveryRequest(limit=1, request_id='11111111-1111-4111-8111-111111111111'), token)
        assert error.value.status_code == 401
        fetch.assert_not_called()


def test_integrated_recovery_returns_provenance_and_metrics(monkeypatch):
    monkeypatch.setenv('SOLOTODO_MANUAL_PROBE_ENABLED', 'true')
    monkeypatch.setenv('SOURCE_INTERNAL_TOKEN', 'b' * 64)
    with patch('main.fetch_cpu_batch', return_value=CpuBatch(retrieved_at=STAMP, results=[cpu()])) as fetch:
        response = TestClient(app).post('/sources/solotodo/cpu/recover', headers={'X-Source-Token': 'b' * 64}, json={'limit': 1, 'request_id': '11111111-1111-4111-8111-111111111111'})
        assert response.status_code == 200
        data = response.json()
        assert data['metrics']['accepted'] == 1
        assert data['source_request_url'] == 'https://api.solotodo.com/products/?categories=3&page_size=1'
        assert data['request_id'] == '11111111-1111-4111-8111-111111111111'
        assert data['retrieval_ms'] >= 0
        assert 'b' * 64 not in response.text
        fetch.assert_called_once_with(1)


@pytest.mark.parametrize('code', ['source_unavailable', 'source_access_denied', 'source_rate_limited'])
def test_integrated_recovery_maps_errors_without_retry(monkeypatch, code):
    monkeypatch.setenv('SOLOTODO_MANUAL_PROBE_ENABLED', 'true')
    monkeypatch.setenv('SOURCE_INTERNAL_TOKEN', 'b' * 64)
    with patch('main.fetch_cpu_batch', side_effect=ProbeError(code)) as fetch:
        response = TestClient(app).post('/sources/solotodo/cpu/recover', headers={'X-Source-Token': 'b' * 64}, json={'limit': 1, 'request_id': '11111111-1111-4111-8111-111111111111'})
        assert response.status_code == 502
        assert response.json()['detail']['code'] == code.upper()
        fetch.assert_called_once()


def test_integrated_recovery_rejects_limit_and_correlation_before_network(monkeypatch):
    monkeypatch.setenv('SOLOTODO_MANUAL_PROBE_ENABLED', 'true')
    monkeypatch.setenv('SOURCE_INTERNAL_TOKEN', 'b' * 64)
    with patch('main.fetch_cpu_batch') as fetch:
        for body in [{'limit': 6, 'request_id': '11111111-1111-4111-8111-111111111111'}, {'limit': 1, 'request_id': 'not-a-uuid'}]:
            response = TestClient(app).post('/sources/solotodo/cpu/recover', headers={'X-Source-Token': 'b' * 64}, json=body)
            assert response.status_code == 422
        fetch.assert_not_called()
