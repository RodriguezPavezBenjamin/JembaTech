"""Preparación de fichas CPU; no modifica el catálogo ni consulta la red."""

import json
import unicodedata
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from time import perf_counter
from typing import Literal

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    ValidationError,
    field_validator,
)


def clean_text(value: str) -> str:
    value = unicodedata.normalize('NFKC', value)
    # No conservar controles invisibles, HTML o descripciones del proveedor.
    value = ''.join(c if not unicodedata.category(c).startswith('C') else ' ' for c in value)
    value = ' '.join(value.split())
    if not value or '<' in value or '>' in value:
        raise ValueError('Texto vacío o marcado no permitido')
    return value


class Brand(BaseModel):
    name: str = Field(min_length=1, max_length=80)

    @field_validator('name')
    @classmethod
    def clean_name(cls, value):
        return clean_text(value)


class CpuSpecs(BaseModel):
    socket_unicode: str = Field(min_length=1, max_length=40)
    core_count_value: int = Field(strict=True, ge=1, le=256)
    thread_count_value: int = Field(strict=True, ge=1, le=512)
    tdp: float | None = Field(default=None, gt=0, le=1000, allow_inf_nan=False)

    @field_validator('socket_unicode')
    @classmethod
    def clean_socket(cls, value):
        return clean_text(value)

    @field_validator('tdp', mode='before')
    @classmethod
    def numeric_tdp(cls, value):
        if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float))):
            raise ValueError('TDP debe ser numérico')
        return value


class RawCpu(BaseModel):
    # Campos ajenos a esta fase (descripción, imágenes, plantillas) se descartan.
    id: int = Field(strict=True, gt=0)
    category_id: int = Field(strict=True)
    name: str = Field(min_length=1, max_length=200)
    brand: Brand
    part_number: str | None = Field(default=None, max_length=120)
    last_updated: AwareDatetime | None = None
    specs: CpuSpecs

    @field_validator('category_id')
    @classmethod
    def only_cpu(cls, value):
        if value != 3:
            raise ValueError('La categoría de procesadores debe ser 3')
        return value

    @field_validator('name')
    @classmethod
    def clean_name(cls, value):
        return clean_text(value)

    @field_validator('part_number')
    @classmethod
    def clean_part_number(cls, value):
        return clean_text(value) if value and value.strip() else None


class CpuBatch(BaseModel):
    model_config = ConfigDict(extra='forbid')
    retrieved_at: AwareDatetime
    # object permite rechazar filas individualmente, sin perder todo el lote.
    results: list[object] = Field(max_length=50)

    @field_validator('retrieved_at')
    @classmethod
    def not_in_future(cls, value):
        if value > datetime.now(timezone.utc) + timedelta(minutes=5):
            raise ValueError('Fecha de recuperación futura')
        return value.astimezone(timezone.utc)


class CpuReference(BaseModel):
    source: Literal['solotodo'] = 'solotodo'
    external_id: str
    category: Literal['cpu'] = 'cpu'
    name: str
    brand: str
    part_number: str | None
    socket: str
    cores: int
    threads: int
    declared_tdp_watts: float | None
    # TDP no es el consumo máximo del equipo ni una recomendación de PSU.
    price_clp: None = None
    source_url: str
    retrieved_at: AwareDatetime
    source_updated_at: AwareDatetime | None
    content_hash: str


class RowIssue(BaseModel):
    index: int
    code: Literal['invalid_record', 'duplicate_id', 'conflicting_duplicate']
    fields: list[str] = Field(default_factory=list)


class QualityMetrics(BaseModel):
    received: int
    accepted: int
    rejected: int
    duplicates: int
    valid_percent: float
    duplicate_percent: float
    missing_tdp: int
    processing_ms: float


class CpuBatchResult(BaseModel):
    schema_version: Literal['solotodo-cpu-1'] = 'solotodo-cpu-1'
    access_status: Literal['reuse-not-confirmed'] = 'reuse-not-confirmed'
    products: list[CpuReference]
    issues: list[RowIssue]
    metrics: QualityMetrics


def normalize_cpu_batch(batch: CpuBatch) -> CpuBatchResult:
    start = perf_counter()
    products: list[CpuReference] = []
    issues: list[RowIssue] = []
    seen: dict[str, str] = {}
    rejected = duplicates = 0
    for index, record in enumerate(batch.results):
        try:
            raw = RawCpu.model_validate(record)
            if raw.last_updated and raw.last_updated > batch.retrieved_at + timedelta(minutes=5):
                raise ValueError('Actualización de origen posterior a la recuperación')
            if raw.specs.thread_count_value < raw.specs.core_count_value:
                raise ValueError('Número de hilos inferior a núcleos')
        except (ValidationError, ValueError) as error:
            rejected += 1
            fields = sorted({'.'.join(map(str, e['loc'])) or '$' for e in error.errors()}) if isinstance(error, ValidationError) else ['specs_or_source_date']
            issues.append(RowIssue(index=index, code='invalid_record', fields=fields))
            continue

        data = {
            'external_id': str(raw.id), 'name': raw.name, 'brand': raw.brand.name,
            'part_number': raw.part_number, 'socket': raw.specs.socket_unicode,
            'cores': raw.specs.core_count_value, 'threads': raw.specs.thread_count_value,
            'declared_tdp_watts': raw.specs.tdp,
        }
        # Hash semántico: no cambia por fecha de consulta ni texto descartado.
        digest = sha256(json.dumps(data, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        external_id = str(raw.id)
        if external_id in seen:
            duplicates += 1
            code = 'duplicate_id' if seen[external_id] == digest else 'conflicting_duplicate'
            issues.append(RowIssue(index=index, code=code))
            continue
        seen[external_id] = digest
        products.append(CpuReference(
            **data, content_hash=digest,
            source_url=f'https://www.solotodo.cl/products/{raw.id}',
            retrieved_at=batch.retrieved_at,
            source_updated_at=raw.last_updated.astimezone(timezone.utc) if raw.last_updated else None,
        ))

    received = len(batch.results)
    return CpuBatchResult(
        products=products, issues=issues,
        metrics=QualityMetrics(
            received=received, accepted=len(products), rejected=rejected,
            duplicates=duplicates,
            valid_percent=round((received - rejected) * 100 / received, 2) if received else 0,
            duplicate_percent=round(duplicates * 100 / received, 2) if received else 0,
            missing_tdp=sum(p.declared_tdp_watts is None for p in products),
            processing_ms=round((perf_counter() - start) * 1000, 3),
        ),
    )
