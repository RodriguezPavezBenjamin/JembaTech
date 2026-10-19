"""Reglas centrales del cotizador. Los precios y fichas llegan del catálogo NestJS."""

from math import ceil
from typing import Any, Literal

from pydantic import BaseModel, Field


def recommended_watts(consumption: int) -> int:
    """Política única: 35% de margen y redondeo hacia arriba a 50 W."""
    return ceil(consumption * 1.35 / 50) * 50


class Component(BaseModel):
    id: str
    category: str
    name: str
    description: str
    price: int = Field(ge=0)
    icon: str
    quantity: int = Field(ge=1, le=8)
    specs: dict[str, Any]


class BuildInput(BaseModel):
    budget: int = Field(gt=0, le=100_000_000)
    intended_use: Literal['oficina', 'estudio', 'gaming', 'programacion', 'edicion']
    catalog_version: str
    components: list[Component] = Field(max_length=32)


class Issue(BaseModel):
    category: str
    severity: Literal['block', 'warning']
    message: str


class BuildAnalysis(BaseModel):
    total_price: int
    ram_gb: int
    storage_gb: int
    psu_watts: int
    estimated_consumption_watts: int
    recommended_watts: int
    remaining_budget: int
    missing: list[str]
    issues: list[Issue]
    can_save: bool
    score: int
    level: str
    warnings: list[str]
    recommendations: list[str]
    explanation: str


def analyze(build: BuildInput) -> BuildAnalysis:
    singles = {c.category: c for c in build.components if c.category not in {'ram', 'storage', 'fan', 'support'}}
    memories = [c for c in build.components if c.category == 'ram']
    drives = [c for c in build.components if c.category == 'storage']
    fans = [c for c in build.components if c.category == 'fan']
    cpu, gpu, board, cooler, case, psu = (
        singles.get(key) for key in ['cpu', 'gpu', 'board', 'cooler', 'case', 'psu']
    )
    missing = [key for key in ['cpu', 'gpu', 'board', 'cooler', 'case', 'psu'] if key not in singles]
    if not memories:
        missing.append('ram')
    if not drives:
        missing.append('storage')
    issues: list[Issue] = []

    def issue(category: str, message: str, severity: Literal['block', 'warning'] = 'block'):
        issues.append(Issue(category=category, severity=severity, message=message))

    partial = any(c.specs.get('unverified') for c in build.components)
    for c in build.components:
        if c.specs.get('unverified'):
            issue(c.category, f'{c.name}: por confirmar: {"; ".join(c.specs["unverified"])}. No se certifica esa parte del montaje.', 'warning')

    if cpu and gpu and gpu.specs.get('integrated') and not cpu.specs.get('integrated'):
        issue('gpu', 'Este procesador no tiene gráficos integrados. Elige una tarjeta dedicada.')
    if cpu and board:
        if cpu.specs['socket'] != board.specs['socket']:
            issue('board', 'La placa y el procesador usan sockets diferentes.')
        if board.specs['ram'] not in cpu.specs['ramTypes']:
            issue('board', 'El tipo de RAM de esta placa no está soportado por el procesador.')
    ram_gb = sum(int(ram.specs['capacityGb']) * ram.quantity for ram in memories)
    ram_modules = sum(int(ram.specs['modules']) * ram.quantity for ram in memories)
    if board and memories:
        if any(ram.specs['ram'] != board.specs['ram'] for ram in memories):
            issue('ram', 'La memoria debe ser del mismo tipo DDR que admite la placa.')
        if board.specs.get('maxRam') is not None and ram_gb > board.specs['maxRam']:
            issue('ram', 'La capacidad de RAM supera el límite del perfil de placa.')
        if ram_modules > board.specs['ramSlots']:
            issue('ram', 'La cantidad total de módulos RAM supera las ranuras de la placa.')
    if len(memories) > 1 or any(ram.quantity > 1 for ram in memories):
        issue('ram', 'Para varios módulos confirma SKU, revisión, QVL y perfil XMP/EXPO: comprados por separado no garantizan el mismo ajuste conjunto.', 'warning')

    nvme = sum(c.quantity for c in drives if c.specs['kind'] == 'NVMe')
    sata = sum(c.quantity for c in drives if c.specs['kind'] != 'NVMe')
    if board and nvme > board.specs['m2']:
        issue('storage', 'Hay más unidades NVMe que ranuras M.2 en la placa.')
    if board and sata > board.specs['sata']:
        issue('storage', 'Hay más unidades SATA que puertos disponibles en la placa.')
    if drives and all(c.specs['kind'] == 'HDD' for c in drives):
        issue('storage', 'Recomendamos un SSD para el sistema y los programas; el HDD puede quedar como secundario.', 'warning')
    if cpu and cooler:
        if cooler.specs['kind'] == 'stock' and not cpu.specs['stockCooler']:
            issue('cooler', 'Este procesador no incluye cooler. Selecciona refrigeración por separado.')
        if cpu.specs['socket'] not in cooler.specs['sockets']:
            issue('cooler', 'El cooler no incluye soporte para el socket del procesador.')
        if cpu.specs['power'] >= 160 and cooler.specs['kind'] in {'air', 'stock'}:
            issue('cooler', 'Revisa la capacidad térmica del cooler para este procesador de alto consumo.', 'warning')
    if case:
        specs = case.specs
        if board and board.specs['form'] not in specs['forms']:
            issue('case', 'El gabinete no admite el formato de la placa seleccionada.')
        if gpu and gpu.specs['lengthMm'] > specs['gpuClearanceMm']:
            issue('case', 'La gráfica supera el espacio del gabinete en este perfil.')
        radiator = cooler.specs['radiatorMm'] if cooler else 0
        if cooler and radiator and 'radiators' in specs and radiator not in specs['radiators']:
            issue('case', 'El gabinete no admite el radiador seleccionado.')
        if cooler and not radiator and cooler.specs['heightMm'] > specs['coolerClearanceMm']:
            issue('case', 'La torre del cooler es demasiado alta para el gabinete.')
        hdd = sum(c.quantity for c in drives if c.specs['kind'] == 'HDD')
        ssd = sum(c.quantity for c in drives if c.specs['kind'] == 'SATA')
        if hdd > specs['bays35']:
            issue('case', 'Faltan bahías de 3,5 pulgadas para los HDD elegidos.')
        if ssd > specs['bays25']:
            issue('case', 'Faltan bahías de 2,5 pulgadas para los SSD SATA elegidos.')
        count120 = sum(c.quantity for c in fans if c.specs['sizeMm'] == 120) + specs.get('included120', 0)
        count140 = sum(c.quantity for c in fans if c.specs['sizeMm'] == 140) + specs.get('included140', 0)
        if radiator:
            if radiator in {280, 420}:
                count140 += radiator // 140
            else:
                count120 += radiator // 120
        if ('fan120' in specs and 'fan140' in specs and
                (count120 > specs['fan120'] or count140 > specs['fan140']
                 or count120 + count140 > max(specs['fan120'], specs['fan140']))):
            issue('case', 'Los ventiladores incluidos, adicionales y del radiador exceden el montaje de referencia. Reduce extras o cambia gabinete.')
        if psu and 'psuForms' in specs and psu.specs['form'] not in specs['psuForms']:
            issue('psu', 'El formato físico de la fuente no es compatible con el gabinete.')

    consumption = sum(int(c.specs.get('power', 45 if c.category == 'board' else 0)) * c.quantity
                      for c in build.components)
    if case:
        consumption += (case.specs.get('included120', 0) + case.specs.get('included140', 0)) * 3
    watts = max(recommended_watts(consumption), int(gpu.specs.get('minPsu', 0)) if gpu else 0)
    if psu:
        if psu.specs['watts'] < watts:
            issue('psu', f'La fuente requiere al menos {watts} W según el consumo con margen y el mínimo declarado para la gráfica.')
        if sata > psu.specs['sataPower']:
            issue('psu', 'La fuente no tiene suficientes conectores de alimentación SATA.')
        if gpu and (gpu.specs['pcie8'] > psu.specs['pcie8'] or gpu.specs['twelveV'] > psu.specs['twelveV']):
            issue('psu', 'La fuente no aporta los conectores requeridos por el perfil de gráfica.')
        if board and board.specs['cpuEps'] > psu.specs['cpuEps']:
            issue('psu', 'Faltan conectores EPS para alimentar la placa.')

    total = sum(c.price * c.quantity for c in build.components)
    capacity = sum(int(c.specs['capacityGb']) * c.quantity for c in drives)
    if total > build.budget:
        issue('budget', f'El armado supera tu presupuesto en ${total - build.budget:,} CLP.', 'warning')
    if memories and ram_gb < 16 and build.intended_use in {'gaming', 'programacion', 'edicion'}:
        issue('ram', 'Para este uso recomendamos al menos 16 GB de RAM.', 'warning')
    if drives and capacity < 500:
        issue('storage', 'Considera al menos 500 GB para sistema y aplicaciones.', 'warning')
    blocked = [item for item in issues if item.severity == 'block']
    warnings = [item.message for item in issues]
    recommendations = ['Confirma modelo exacto, BIOS, dimensiones, conectores y montaje antes de comprar. Revisa en cada ficha si el precio es consultado o estimado; el consumo es de planificación.']
    score = max(0, 100 - len(blocked) * 25 - sum(i.severity == 'warning' for i in issues) * 10)
    return BuildAnalysis(
        total_price=total, ram_gb=ram_gb, storage_gb=capacity,
        psu_watts=int(psu.specs['watts']) if psu else 0,
        estimated_consumption_watts=consumption, recommended_watts=watts,
        remaining_budget=build.budget - total, missing=missing, issues=issues,
        can_save=not missing and not blocked, score=score,
        level='Revisión preliminar' if missing else 'Requiere ajustes' if blocked else 'Revisión parcial · confirmar montaje' if partial else 'Compatible con el perfil',
        warnings=warnings, recommendations=recommendations,
        explanation='Revisión de presupuesto, conexiones, espacio y potencia sobre perfiles de referencia. El consumo es una estimación; no certifica compatibilidad del modelo final.',
    )
