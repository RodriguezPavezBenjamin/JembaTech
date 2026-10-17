import asyncio
import json
from unittest.mock import patch
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from observability import REQUEST_ID, HTTPObservability, safe_request_id


def make_app():
    app = FastAPI()
    app.add_middleware(HTTPObservability)

    @app.get('/echo/{item}')
    def echo(item: str):
        return {'requestId': REQUEST_ID.get()}

    @app.get('/fail')
    def fail():
        raise ValueError('PRIVATE-QA-secret')

    return app


def test_valid_id_and_sync_thread_context_without_private_fields():
    correlation = str(uuid4())
    with patch('observability.emit_event') as log, TestClient(make_app()) as client:
        response = client.get('/echo/private-name?email=PRIVATE-QA-secret', headers={
            'X-Request-Id': correlation, 'Authorization': 'Bearer PRIVATE-QA-secret',
        })
    assert response.headers['x-request-id'] == correlation
    assert response.json()['requestId'] == correlation
    assert log.call_args.kwargs['route'] == '/echo/{item}'
    assert 'PRIVATE-QA-secret' not in str(log.call_args_list)
    assert REQUEST_ID.get() is None


def test_invalid_duplicate_or_non_ascii_ids_are_replaced():
    for headers in [[], [(b'x-request-id', b'private-data')], [(b'x-request-id', b'\xff')],
                    [(b'x-request-id', str(uuid4()).encode())] * 2]:
        value = safe_request_id(headers)
        assert len(value) == 36
        assert value != 'private-data'


def test_errors_and_unmatched_urls_have_id_without_leaking_details():
    with patch('observability.emit_event') as log, TestClient(make_app()) as client:
        failed = client.get('/fail')
        assert failed.status_code == 500
        assert failed.headers['x-request-id']
        assert 'PRIVATE-QA-secret' not in failed.text
        assert log.call_args.kwargs['status'] == 500
        assert log.call_args.kwargs['outcome'] == 'error'
        missing = client.get('/PRIVATE-QA-secret')
        assert missing.status_code == 404
        assert log.call_args.kwargs['route'] == 'unmatched'
        assert 'PRIVATE-QA-secret' not in str(log.call_args_list)


def test_context_isolated_across_concurrent_asgi_requests():
    ids = [str(uuid4()), str(uuid4())]

    async def endpoint(scope, receive, send):
        await asyncio.sleep(0.01)
        await send({'type': 'http.response.start', 'status': 200, 'headers': []})
        await send({'type': 'http.response.body', 'body': json.dumps({'id': REQUEST_ID.get()}).encode()})

    async def request(correlation):
        messages = []

        async def send(message):
            messages.append(message)

        async def receive():
            return {'type': 'http.request', 'body': b''}

        await HTTPObservability(endpoint)({'type': 'http', 'method': 'GET', 'headers': [
            (b'x-request-id', correlation.encode()),
        ]}, receive, send)
        return json.loads(messages[-1]['body'])['id']

    async def run():
        return await asyncio.gather(*(request(correlation) for correlation in ids))

    with patch('observability.emit_event'):
        assert asyncio.run(run()) == ids
    assert REQUEST_ID.get() is None


def test_interrupted_response_is_not_rewritten_or_logged_with_private_exception():
    messages = []

    async def endpoint(scope, receive, send):
        await send({'type': 'http.response.start', 'status': 200, 'headers': []})
        raise ValueError('PRIVATE-QA-secret')

    async def send(message):
        messages.append(message)

    async def receive():
        return {'type': 'http.request', 'body': b''}

    with patch('observability.emit_event') as log, pytest.raises(RuntimeError, match='service_response_interrupted'):
        asyncio.run(HTTPObservability(endpoint)({'type': 'http', 'method': 'GET', 'headers': []}, receive, send))
    assert len(messages) == 1 and messages[0]['status'] == 200
    assert log.call_args.kwargs['outcome'] == 'aborted'
    assert log.call_args.kwargs['code'] == 'RESPONSE_INTERRUPTED'
    assert 'PRIVATE-QA-secret' not in str(log.call_args_list)
    assert REQUEST_ID.get() is None
