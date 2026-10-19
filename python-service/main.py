import os
import re
import secrets
from datetime import datetime
from time import perf_counter
from uuid import UUID

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from builds import BuildAnalysis, BuildInput, analyze, recommended_watts
from observability import HTTPObservability, emit_event
from probe_solotodo import (
    COMPONENT_TARGETS,
    ProbeError,
    fetch_component_batch,
    fetch_cpu_batch,
    target_category_id,
    target_terms,
)
from solotodo import CpuBatch, CpuBatchResult, normalize_cpu_batch
from solotodo_catalog import TARGETS as CATALOG_TARGETS
from solotodo_catalog import recover_catalog
from solotodo_components import ComponentBatch, normalize_component_batch
from solotodo_prices import PRICE_TARGETS, recover_prices

app = FastAPI(title='JembaTech Evaluator', version='0.1.0')
app.add_middleware(HTTPObservability)


class ComponentRecoveryRequest(BaseModel):
    target: str = Field(min_length=1, max_length=40)
    request_id: UUID


@app.post('/sources/solotodo/catalog/recover', tags=['sources'])
def recover_solotodo_catalog(request: ComponentRecoveryRequest, x_source_token: str = Header(default='')):
    token = os.environ.get('SOURCE_INTERNAL_TOKEN', '')
    if os.environ.get('SOLOTODO_MANUAL_PROBE_ENABLED') != 'true' or not re.fullmatch(r'[a-f0-9]{64}', token):
        raise HTTPException(status_code=503, detail={'code': 'MANUAL_PROBE_DISABLED'})
    if not secrets.compare_digest(x_source_token.encode(), token.encode()):
        raise HTTPException(status_code=401, detail={'code': 'INTERNAL_AUTH_REQUIRED'})
    if request.target not in CATALOG_TARGETS:
        raise HTTPException(status_code=422, detail={'code': 'INVALID_TARGET'})
    try:
        result = recover_catalog(request.target)
    except ProbeError as error:
        safe = {'source_unavailable', 'source_rate_limited', 'source_access_denied', 'source_http_error', 'invalid_source_contract', 'response_too_large'}
        raise HTTPException(status_code=502, detail={'code': str(error).upper() if str(error) in safe else 'SOURCE_FAILED'}) from error
    return {**result, 'requestId': str(request.request_id)}


@app.post('/sources/solotodo/prices/recover', tags=['sources'])
def recover_solotodo_prices(request: ComponentRecoveryRequest, x_source_token: str = Header(default='')):
    token = os.environ.get('SOURCE_INTERNAL_TOKEN', '')
    if os.environ.get('SOLOTODO_MANUAL_PROBE_ENABLED') != 'true' or not re.fullmatch(r'[a-f0-9]{64}', token):
        raise HTTPException(status_code=503, detail={'code': 'MANUAL_PROBE_DISABLED'})
    if not secrets.compare_digest(x_source_token.encode(), token.encode()):
        raise HTTPException(status_code=401, detail={'code': 'INTERNAL_AUTH_REQUIRED'})
    if request.target not in PRICE_TARGETS:
        raise HTTPException(status_code=422, detail={'code': 'INVALID_TARGET'})
    try:
        result = recover_prices(request.target)
    except ProbeError as error:
        safe = {'source_unavailable', 'source_rate_limited', 'source_access_denied', 'source_http_error', 'invalid_source_contract', 'response_too_large'}
        code = str(error).upper() if str(error) in safe else 'SOURCE_FAILED'
        raise HTTPException(status_code=502, detail={'code': code}) from error
    return {**result, 'requestId': str(request.request_id)}


@app.post('/sources/solotodo/components/normalize', tags=['sources'])
def normalize_solotodo_components(batch: ComponentBatch):
    return normalize_component_batch(batch)


@app.post('/sources/solotodo/components/recover', tags=['sources'])
def recover_solotodo_components(request: ComponentRecoveryRequest, x_source_token: str = Header(default='')):
    token = os.environ.get('SOURCE_INTERNAL_TOKEN', '')
    if os.environ.get('SOLOTODO_MANUAL_PROBE_ENABLED') != 'true' or not re.fullmatch(r'[a-f0-9]{64}', token):
        raise HTTPException(status_code=503, detail={'code': 'MANUAL_PROBE_DISABLED'})
    if not secrets.compare_digest(x_source_token.encode(), token.encode()):
        raise HTTPException(status_code=401, detail={'code': 'INTERNAL_AUTH_REQUIRED'})
    if request.target not in COMPONENT_TARGETS:
        raise HTTPException(status_code=422, detail={'code': 'INVALID_TARGET'})
    started = perf_counter()
    try:
        batch = fetch_component_batch(request.target)
    except ProbeError as error:
        safe_codes = {'source_unavailable', 'source_rate_limited', 'source_access_denied', 'source_http_error',
                      'invalid_source_contract', 'unexpected_content_type', 'response_too_large'}
        code = str(error).upper() if str(error) in safe_codes else 'SOURCE_FAILED'
        emit_event('source_request', runId=str(request.request_id), source='solotodo', code=code)
        raise HTTPException(status_code=502, detail={'code': code}) from error
    retrieval_ms = round((perf_counter() - started) * 1000, 3)
    result = normalize_component_batch(batch, target_terms(request.target), target_category_id(request.target))
    emit_event('source_request', runId=str(request.request_id), source='solotodo', category=batch.category,
               received=result['metrics']['received'], accepted=result['metrics']['accepted'], durationMs=retrieval_ms)
    return {**result, 'retrieved_at': batch.retrieved_at, 'request_id': request.request_id,
            'target': request.target, 'source_request_url': COMPONENT_TARGETS[request.target][1],
            'retrieval_ms': retrieval_ms}


class CpuRecoveryRequest(BaseModel):
    limit: int = Field(default=1, strict=True, ge=1, le=5)
    request_id: UUID


class CpuRecoveryResult(CpuBatchResult):
    retrieved_at: datetime
    request_id: UUID
    source_request_url: str
    retrieval_ms: float


@app.post('/sources/solotodo/cpu/recover', response_model=CpuRecoveryResult, tags=['sources'])
def recover_solotodo_cpu(request: CpuRecoveryRequest, x_source_token: str = Header(default='')):
    """Una consulta pública puntual; sin paginación, imágenes ni sincronización."""
    token = os.environ.get('SOURCE_INTERNAL_TOKEN', '')
    if os.environ.get('SOLOTODO_MANUAL_PROBE_ENABLED') != 'true' or not re.fullmatch(r'[a-f0-9]{64}', token):
        raise HTTPException(status_code=503, detail={'code': 'MANUAL_PROBE_DISABLED'})
    if not secrets.compare_digest(x_source_token.encode(), token.encode()):
        raise HTTPException(status_code=401, detail={'code': 'INTERNAL_AUTH_REQUIRED'})
    start = perf_counter()
    try:
        batch = fetch_cpu_batch(request.limit)
    except ProbeError as error:
        safe_codes = {'source_unavailable', 'source_rate_limited', 'source_access_denied', 'source_http_error',
                      'invalid_source_contract', 'unexpected_content_type', 'response_too_large'}
        code = str(error).upper() if str(error) in safe_codes else 'SOURCE_FAILED'
        emit_event('source_request', runId=str(request.request_id), source='solotodo', code=code,
                   durationMs=round((perf_counter() - start) * 1000, 3))
        raise HTTPException(status_code=502, detail={'code': code}) from error
    retrieval_ms = round((perf_counter() - start) * 1000, 3)
    result = normalize_cpu_batch(batch)
    emit_event('source_request', runId=str(request.request_id), source='solotodo',
               durationMs=retrieval_ms, received=result.metrics.received, accepted=result.metrics.accepted)
    return CpuRecoveryResult(
        **result.model_dump(), retrieved_at=batch.retrieved_at,
        request_id=request.request_id,
        source_request_url=f'https://api.solotodo.com/products/?categories=3&page_size={request.limit}',
        retrieval_ms=retrieval_ms,
    )


@app.post('/sources/solotodo/cpu/normalize', response_model=CpuBatchResult, tags=['sources'])
def normalize_solotodo_cpu(batch: CpuBatch):
    """Prepara un lote acotado; no consulta la red ni altera cotizaciones."""
    return normalize_cpu_batch(batch)


@app.post('/builds/preview', response_model=BuildAnalysis)
def preview_build(build: BuildInput):
    return analyze(build)


class BuildRequest(BaseModel):
    budget: int = Field(gt=0, description='Presupuesto maximo en CLP')
    intended_use: str
    total_price: int = Field(ge=0)
    ram_gb: int = Field(ge=0)
    storage_gb: int = Field(ge=0)
    psu_watts: int = Field(ge=0)
    estimated_consumption_watts: int = Field(ge=0)


class Evaluation(BaseModel):
    score: int
    level: str
    warnings: list[str]
    recommendations: list[str]
    explanation: str


@app.get('/health')
def health():
    return {'status': 'ok', 'service': 'jemba-evaluator'}


@app.post('/evaluate', response_model=Evaluation)
def evaluate(build: BuildRequest):
    score = 100
    warnings: list[str] = []
    recommendations: list[str] = []

    if build.total_price > build.budget:
        score -= 25
        warnings.append('La configuracion supera el presupuesto definido.')
        recommendations.append('Reduce componentes no esenciales o aumenta el presupuesto.')
    if build.psu_watts < recommended_watts(build.estimated_consumption_watts):
        score -= 30
        warnings.append('La fuente de poder no deja margen de seguridad suficiente.')
        recommendations.append('Usa una fuente con 35% de margen, redondeado hacia arriba a 50 W.')
    if build.ram_gb < 16 and build.intended_use.lower() in {'gaming', 'edicion', 'programacion'}:
        score -= 15
        warnings.append('16 GB de RAM es el minimo recomendado para este uso.')
    if build.storage_gb < 500:
        score -= 10
        recommendations.append('Considera al menos 500 GB SSD para sistema, programas y juegos.')

    score = max(score, 0)
    level = 'Excelente' if score >= 85 else 'Aceptable' if score >= 60 else 'Requiere ajustes'
    return Evaluation(
        score=score,
        level=level,
        warnings=warnings,
        recommendations=recommendations,
        explanation='La nota combina presupuesto, margen de potencia, memoria y almacenamiento. Puedes modificar la configuracion y volver a evaluarla.',
    )
