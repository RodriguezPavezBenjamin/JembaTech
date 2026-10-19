"""Referencias privadas de componentes. Sin fotos, ofertas ni vínculo automático."""

import json
import re
from datetime import timedelta
from hashlib import sha256
from time import perf_counter
from typing import Literal

from pydantic import (
    AwareDatetime,
    BaseModel,
    Field,
    ValidationError,
    field_validator,
    model_validator,
)

from solotodo import Brand, CpuBatch, QualityMetrics, RawCpu, RowIssue, clean_text


class GpuSpecs(BaseModel):
    gpu_unicode: str = Field(min_length=1, max_length=160)
    gpu_brand_unicode: Literal['AMD', 'NVIDIA']
    # La API expresa la cantidad en unidades de 1024 por GB (8192 -> 8 GB).
    memory_quantity_value: int = Field(strict=True, ge=512, le=262144)
    memory_type_unicode: str = Field(min_length=1, max_length=40)
    gpu_tdp: float | None = Field(default=None, gt=0, le=1500, allow_inf_nan=False)
    length: float | None = Field(default=None, gt=0, le=1000, allow_inf_nan=False)
    slot_type_value: float | None = Field(default=None, gt=0, le=8, allow_inf_nan=False)
    bus_unicode: str | None = Field(default=None, max_length=80)

    @field_validator('gpu_unicode', 'memory_type_unicode', 'bus_unicode')
    @classmethod
    def clean_strings(cls, value):
        return clean_text(value) if value is not None else None

    @field_validator('gpu_tdp', 'length', 'slot_type_value', mode='before')
    @classmethod
    def numbers_only(cls, value):
        if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float))):
            raise ValueError('El atributo debe ser numérico')
        return value


class RawGpu(BaseModel):
    id: int = Field(strict=True, gt=0)
    category_id: Literal[2]
    name: str = Field(min_length=1, max_length=200)
    brand: Brand
    part_number: str | None = Field(default=None, max_length=120)
    last_updated: AwareDatetime | None = None
    specs: GpuSpecs

    @field_validator('category_id', mode='before')
    @classmethod
    def strict_category(cls, value):
        if type(value) is not int or value != 2:
            raise ValueError('Categoría GPU inválida')
        return value

    @field_validator('name')
    @classmethod
    def clean_name(cls, value):
        return clean_text(value)

    @field_validator('part_number')
    @classmethod
    def clean_part_number(cls, value):
        return clean_text(value) if value and value.strip() else None


class StoragePort(BaseModel):
    quantity: int = Field(strict=True, ge=1, le=64)
    port_connector_name: str = Field(min_length=1, max_length=80)

    @field_validator('port_connector_name')
    @classmethod
    def clean_connector(cls, value):
        return clean_text(value)


class MotherboardSpecs(BaseModel):
    chipset_northbridge_family_socket_unicode: str = Field(min_length=1, max_length=40)
    chipset_unicode: str = Field(min_length=1, max_length=100)
    format_unicode: str = Field(min_length=1, max_length=40)
    memory_slots_mtype_itype_type_name: Literal['DDR4', 'DDR5']
    memory_slots_quantity: int = Field(strict=True, ge=1, le=32)
    storage_ports: list[StoragePort] | None = Field(default=None, max_length=40)

    @field_validator('chipset_northbridge_family_socket_unicode', 'chipset_unicode', 'format_unicode')
    @classmethod
    def clean_strings(cls, value):
        return clean_text(value)


class RamSpecs(BaseModel):
    capacity_total_capacity_value: int = Field(strict=True, ge=256, le=4194304)
    capacity_dimm_capacity_value: int = Field(strict=True, ge=256, le=1048576)
    capacity_dimm_quantity_value: int = Field(strict=True, ge=1, le=16)
    bus_bus_bus_type_name: Literal['DDR4', 'DDR5']
    bus_bus_bus_format_name: str = Field(min_length=1, max_length=30)
    bus_frequency_value: int = Field(strict=True, ge=100, le=20000)
    latency_cl_value: int | None = Field(default=None, strict=True, ge=1, le=200)

    @field_validator('bus_bus_bus_format_name')
    @classmethod
    def clean_format(cls, value):
        return clean_text(value)

    @model_validator(mode='after')
    def consistent_kit(self):
        if self.capacity_dimm_capacity_value * self.capacity_dimm_quantity_value != self.capacity_total_capacity_value:
            raise ValueError('Capacidad total inconsistente con los módulos del kit')
        return self


class StorageSpecs(BaseModel):
    # Discos: capacidad comercial en GB decimales. NO aplicar conversión de RAM/VRAM.
    capacity_value: int = Field(strict=True, ge=1, le=1000000)
    type_name: str | None = Field(default=None, max_length=40)
    bus_bus_bus_with_version_bus_name: str | None = Field(default=None, max_length=40)
    bus_unicode: str | None = Field(default=None, max_length=100)
    size_unicode: str | None = Field(default=None, max_length=40)
    rpm_value: int | None = Field(default=None, strict=True, ge=1, le=30000)
    ssd_type_bus_bus_with_version_bus_name: str | None = Field(default=None, max_length=40)
    ssd_type_bus_unicode: str | None = Field(default=None, max_length=100)
    ssd_type_format_unicode: str | None = Field(default=None, max_length=40)
    ssd_type_connector_unicode: str | None = Field(default=None, max_length=80)
    sequential_read_speed: int | None = Field(default=None, strict=True, ge=1, le=100000)
    sequential_write_speed: int | None = Field(default=None, strict=True, ge=1, le=100000)

    @field_validator('type_name', 'bus_bus_bus_with_version_bus_name', 'bus_unicode', 'size_unicode',
                     'ssd_type_bus_bus_with_version_bus_name', 'ssd_type_bus_unicode',
                     'ssd_type_format_unicode', 'ssd_type_connector_unicode')
    @classmethod
    def clean_strings(cls, value):
        return clean_text(value) if value is not None else None


class RawMotherboard(RawGpu):
    category_id: Literal[5]
    specs: MotherboardSpecs

    @field_validator('category_id', mode='before')
    @classmethod
    def strict_category(cls, value):
        if type(value) is not int or value != 5:
            raise ValueError('Categoría de placa inválida')
        return value


class RawRam(RawGpu):
    category_id: Literal[7]
    specs: RamSpecs

    @field_validator('category_id', mode='before')
    @classmethod
    def strict_category(cls, value):
        if type(value) is not int or value != 7:
            raise ValueError('Categoría RAM inválida')
        return value


class RawStorage(RawGpu):
    category_id: Literal[8, 39]
    specs: StorageSpecs

    @field_validator('category_id', mode='before')
    @classmethod
    def strict_category(cls, value):
        if type(value) is not int or value not in (8, 39):
            raise ValueError('Categoría de almacenamiento inválida')
        return value


def storage_specs(raw: RawStorage):
    s = raw.specs
    if raw.category_id == 8:
        if s.type_name != 'HDD' or not s.bus_bus_bus_with_version_bus_name or not s.bus_unicode or not s.size_unicode:
            raise ValueError('Ficha HDD sin tipo, interfaz o formato')
        return {'storageType': 'HDD', 'capacityGb': s.capacity_value,
                'interface': s.bus_bus_bus_with_version_bus_name, 'bus': s.bus_unicode,
                'formFactor': s.size_unicode, 'connector': None, 'rpm': s.rpm_value,
                'readMbps': None, 'writeMbps': None, 'protocol': None, 'declaredTdpWatts': None}
    if not s.ssd_type_bus_bus_with_version_bus_name or not s.ssd_type_bus_unicode or not s.ssd_type_format_unicode:
        raise ValueError('Ficha SSD sin interfaz o formato')
    # M.2 es formato; PCIe es interfaz. No inventar NVMe a partir de esos campos.
    return {'storageType': 'SSD', 'capacityGb': s.capacity_value,
            'interface': s.ssd_type_bus_bus_with_version_bus_name, 'bus': s.ssd_type_bus_unicode,
            'formFactor': s.ssd_type_format_unicode, 'connector': s.ssd_type_connector_unicode,
            'rpm': None, 'readMbps': s.sequential_read_speed, 'writeMbps': s.sequential_write_speed,
            'protocol': None, 'declaredTdpWatts': None}


def matches_target(name: str, chip: str, terms: tuple[str, ...]):
    # Solo comprueba pertinencia de familia; no aprueba un SKU ni equivalencia exacta.
    haystack = re.sub(r'[^a-z0-9]', '', (name + ' ' + chip).casefold())
    return all(re.sub(r'[^a-z0-9]', '', term.casefold()) in haystack for term in terms)


class ComponentBatch(CpuBatch):
    category: Literal['cpu', 'gpu', 'motherboard', 'ram', 'storage']
    results: list[object] = Field(max_length=5)


def normalize_component_batch(batch: ComponentBatch, required_terms: tuple[str, ...] = (), expected_category_id: int | None = None):
    started = perf_counter()
    products, issues = [], []
    seen = {}
    rejected = duplicates = 0
    for index, record in enumerate(batch.results):
        try:
            models = {'cpu': RawCpu, 'gpu': RawGpu, 'motherboard': RawMotherboard, 'ram': RawRam, 'storage': RawStorage}
            raw = models[batch.category].model_validate(record)
            if expected_category_id is not None and raw.category_id != expected_category_id:
                raise ValueError('La ficha no pertenece a la categoría externa solicitada')
            if raw.last_updated and raw.last_updated > batch.retrieved_at + timedelta(minutes=5):
                raise ValueError('Actualización futura')
            if batch.category == 'cpu':
                specs = {
                    'socket': raw.specs.socket_unicode,
                    'cores': raw.specs.core_count_value + raw.specs.e_core_count_value,
                    'performanceCores': raw.specs.core_count_value,
                    'efficiencyCores': raw.specs.e_core_count_value,
                    'threads': raw.specs.thread_count_value,
                    'declaredTdpWatts': raw.specs.tdp,
                }
            elif batch.category == 'gpu':
                specs = {
                    'chip': raw.specs.gpu_unicode, 'chipBrand': raw.specs.gpu_brand_unicode,
                    'vramGb': raw.specs.memory_quantity_value / 1024,
                    'memoryType': raw.specs.memory_type_unicode,
                    'declaredTdpWatts': raw.specs.gpu_tdp,
                    'lengthMm': raw.specs.length, 'slots': raw.specs.slot_type_value,
                    'bus': raw.specs.bus_unicode,
                }
            elif batch.category == 'motherboard':
                ports = raw.specs.storage_ports
                specs = {'socket': raw.specs.chipset_northbridge_family_socket_unicode,
                         'chipset': raw.specs.chipset_unicode, 'formFactor': raw.specs.format_unicode,
                         'ramType': raw.specs.memory_slots_mtype_itype_type_name, 'ramSlots': raw.specs.memory_slots_quantity,
                         'm2Slots': sum(p.quantity for p in ports if p.port_connector_name.startswith('M.2')) if ports is not None else None,
                         'sataPorts': sum(p.quantity for p in ports if p.port_connector_name == 'SATA') if ports is not None else None,
                         'declaredTdpWatts': None}
            elif batch.category == 'ram':
                specs = {'capacityGb': raw.specs.capacity_total_capacity_value / 1024,
                         'moduleCapacityGb': raw.specs.capacity_dimm_capacity_value / 1024,
                         'modules': raw.specs.capacity_dimm_quantity_value,
                         'ramType': raw.specs.bus_bus_bus_type_name,
                         'formFactor': raw.specs.bus_bus_bus_format_name, 'speedMt': raw.specs.bus_frequency_value,
                         'casLatency': raw.specs.latency_cl_value, 'declaredTdpWatts': None}
            else:
                specs = storage_specs(raw)
        except (ValidationError, ValueError) as error:
            rejected += 1
            fields = sorted({'.'.join(map(str, e['loc'])) or '$' for e in error.errors()}) if isinstance(error, ValidationError) else ['specs_or_source_date']
            issues.append(RowIssue(index=index, code='invalid_record', fields=fields))
            continue
        if not matches_target(raw.name, specs.get('chip', ''), required_terms):
            rejected += 1
            issues.append(RowIssue(index=index, code='target_mismatch', fields=['name']))
            continue
        identity = str(raw.id)
        data = {'external_id': identity, 'category': batch.category, 'name': raw.name,
                'brand': raw.brand.name, 'part_number': raw.part_number, 'specs': specs}
        digest = sha256(json.dumps(data, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        if identity in seen:
            duplicates += 1
            issues.append(RowIssue(index=index, code='duplicate_id' if seen[identity] == digest else 'conflicting_duplicate'))
            continue
        seen[identity] = digest
        products.append({**data, 'source': 'solotodo', 'price_clp': None,
                         'source_url': f'https://www.solotodo.cl/products/{raw.id}',
                         'retrieved_at': batch.retrieved_at.isoformat(),
                         'source_updated_at': raw.last_updated.isoformat() if raw.last_updated else None,
                         'content_hash': digest})
    received = len(batch.results)
    metrics = QualityMetrics(
        received=received, accepted=len(products), rejected=rejected, duplicates=duplicates,
        valid_percent=round((received - rejected) * 100 / received, 2) if received else 0,
        duplicate_percent=round(duplicates * 100 / received, 2) if received else 0,
        missing_tdp=sum(p['specs']['declaredTdpWatts'] is None for p in products) if batch.category in ('cpu', 'gpu') else 0,
        processing_ms=round((perf_counter() - started) * 1000, 3),
    )
    return {'schema_version': 'solotodo-components-2', 'access_status': 'reuse-not-confirmed',
            'category': batch.category, 'products': products,
            'issues': [issue.model_dump() for issue in issues], 'metrics': metrics.model_dump()}
