"""Correlación y logs ASGI sin cuerpos, cabeceras privadas ni URLs de usuario."""
import asyncio
import json
import re
from contextvars import ContextVar
from datetime import datetime, timezone
from time import perf_counter
from uuid import uuid4

REQUEST_ID = ContextVar('request_id', default=None)
UUID_PATTERN = re.compile(r'[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}', re.IGNORECASE)
METHODS = {'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'}


def emit_event(event, **fields):
    print(json.dumps({
        'timestamp': datetime.now(timezone.utc).isoformat(), 'service': 'jemba-evaluator',
        'event': event, 'requestId': REQUEST_ID.get(), **fields,
    }, ensure_ascii=True), flush=True)


def safe_request_id(headers):
    values = [value for key, value in headers if key.lower() == b'x-request-id']
    if len(values) == 1:
        try:
            value = values[0].decode('ascii')
            if UUID_PATTERN.fullmatch(value):
                return value.lower()
        except UnicodeDecodeError:
            pass
    return str(uuid4())


class HTTPObservability:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            return await self.app(scope, receive, send)
        correlation = safe_request_id(scope.get('headers', []))
        token = REQUEST_ID.set(correlation)
        started_at = perf_counter()
        status = 0
        started = False
        completed = False
        outcome = 'ok'

        async def traced_send(message):
            nonlocal status, started, completed
            if message['type'] == 'http.response.start':
                status = message['status']
                headers = [(key, value) for key, value in message.get('headers', []) if key.lower() != b'x-request-id']
                message = {**message, 'headers': [*headers, (b'x-request-id', correlation.encode('ascii'))]}
                started = True
            await send(message)
            if message['type'] == 'http.response.body' and not message.get('more_body', False):
                completed = True

        try:
            await self.app(scope, receive, traced_send)
        except asyncio.CancelledError:
            outcome = 'aborted'
            raise
        except Exception:  # noqa: BLE001 -- Frontera ASGI: sanear cualquier fallo sin loguear detalles privados.
            outcome = 'error'
            # No reenviar excepciones con mensajes/tracebacks que puedan incluir
            # datos de entrada, SQL o secretos al logger por defecto de Uvicorn.
            if not started:
                await traced_send({'type': 'http.response.start', 'status': 500,
                                   'headers': [(b'content-type', b'application/json')]})
                await traced_send({'type': 'http.response.body', 'body': b'{"detail":"Internal service error"}'})
            else:
                # No fabricar otro status cuando ya se enviaron las cabeceras.
                raise RuntimeError('service_response_interrupted') from None
        finally:
            route = getattr(scope.get('route'), 'path', 'unmatched')
            emit_event('http_request', method=scope.get('method') if scope.get('method') in METHODS else 'OTHER',
                       route=route, status=status, durationMs=round((perf_counter() - started_at) * 1000, 3),
                       outcome=('error' if status >= 500 else outcome) if completed else 'aborted',
                       **({'code': 'HTTP_SERVER_ERROR'} if status >= 500 else
                          {'code': 'RESPONSE_INTERRUPTED'} if outcome == 'error' else {}))
            REQUEST_ID.reset(token)
