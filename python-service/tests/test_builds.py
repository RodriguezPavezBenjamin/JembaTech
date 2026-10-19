from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from builds import BuildInput, analyze, recommended_watts
from main import app


def component(category, price=10000, quantity=1, **specs):
    return {
        'id': category, 'category': category, 'name': category,
        'description': 'Perfil de prueba', 'icon': category,
        'price': price, 'quantity': quantity, 'specs': specs,
    }


@pytest.fixture
def configuration():
    return {
        'budget': 900000, 'intended_use': 'gaming', 'catalog_version': 'test',
        'components': [
            component('cpu', socket='AM5', ramTypes=['DDR5'], power=88,
                      integrated=True, stockCooler=True),
            component('gpu', integrated=True, power=0, lengthMm=0, pcie8=0, twelveV=0),
            component('board', socket='AM5', ram='DDR5', ramSlots=4, maxRam=128,
                      m2=2, sata=4, form='ATX', cpuEps=1),
            component('ram', ram='DDR5', capacityGb=32, modules=2, power=8),
            component('storage', kind='NVMe', capacityGb=1000, power=10),
            component('cooler', kind='stock', heightMm=70, radiatorMm=0, power=3,
                      sockets=['AM5']),
            component('case', forms=['ATX'], gpuClearanceMm=370, coolerClearanceMm=170,
                      radiators=[120, 240, 360], fan120=8, fan140=4,
                      included120=3, included140=0, bays25=3, bays35=2, psuForms=['ATX']),
            component('psu', watts=650, form='ATX', pcie8=2, twelveV=0, sataPower=4, cpuEps=1),
        ],
    }


def evaluate(configuration):
    return analyze(BuildInput.model_validate(configuration))


def test_mixed_storage_counts_capacity_price_and_power(configuration):
    configuration['components'].append(component('storage', quantity=2, kind='HDD', capacityGb=2000, power=10))
    result = evaluate(configuration)
    assert result.storage_gb == 5000
    assert result.total_price == 100000
    assert result.estimated_consumption_watts == 183
    assert result.can_save


def test_budget_is_independent_from_build_total(configuration):
    configuration['budget'] = 50000
    result = evaluate(configuration)
    assert result.remaining_budget == -30000
    assert any(item.category == 'budget' for item in result.issues)


def test_individual_64gb_modules_count_slots_capacity_and_subtotal(configuration):
    configuration['components'][3].update(quantity=2, price=100000)
    configuration['components'][3]['specs'].update(capacityGb=64, modules=1, power=4)
    configuration['components'][2]['specs'].update(ramSlots=2)
    result = evaluate(configuration)
    assert result.ram_gb == 128 and result.total_price == 270000
    assert result.can_save
    assert any('XMP/EXPO' in warning for warning in result.warnings)
    configuration['components'][3]['quantity'] = 3
    assert not evaluate(configuration).can_save


def test_psu_margin_rounds_up_at_boundary():
    assert recommended_watts(400) == 550
    assert recommended_watts(407) == 550
    assert recommended_watts(408) == 600


def test_too_many_nvme_drives_block_saving(configuration):
    configuration['components'][4]['quantity'] = 3
    result = evaluate(configuration)
    assert not result.can_save
    assert any(item.category == 'storage' and item.severity == 'block' for item in result.issues)


def test_case_checks_hdd_bays(configuration):
    configuration['components'].append(component('storage', quantity=3, kind='HDD', capacityGb=2000, power=10))
    assert any('bahías' in item.message for item in evaluate(configuration).issues)


def test_gpu_connector_and_psu_form_are_checked(configuration):
    configuration['components'][1]['specs'].update(integrated=False, power=220, twelveV=1)
    configuration['components'][-1]['specs']['form'] = 'SFX'
    issues = evaluate(configuration).issues
    assert any('formato físico' in item.message for item in issues)
    assert any('conectores' in item.message for item in issues)


def test_stock_cooler_is_not_available_for_every_cpu(configuration):
    configuration['components'][0]['specs']['stockCooler'] = False
    assert any(item.category == 'cooler' and item.severity == 'block' for item in evaluate(configuration).issues)


def test_included_fans_count_for_mounting_but_are_not_charged_twice(configuration):
    original = deepcopy(configuration)
    configuration['components'].append(component('fan', quantity=6, sizeMm=120, power=3))
    result = evaluate(configuration)
    assert any('ventiladores' in item.message for item in result.issues)
    assert result.total_price == evaluate(original).total_price + 60000


def test_radiator_incompatibility_blocks_saving(configuration):
    configuration['components'][5]['specs'].update(kind='aio', radiatorMm=420)
    assert not evaluate(configuration).can_save
    assert any('radiador' in item.message for item in evaluate(configuration).issues)


def test_missing_parts_do_not_claim_complete_compatibility(configuration):
    configuration['components'] = configuration['components'][:1]
    result = evaluate(configuration)
    assert not result.can_save
    assert result.level == 'Revisión preliminar'
    assert 'storage' in result.missing


def test_preview_endpoint_validates_contract(configuration):
    client = TestClient(app)
    assert client.post('/builds/preview', json=configuration).json()['can_save']
    configuration['components'][4]['quantity'] = -1
    assert client.post('/builds/preview', json=configuration).status_code == 422


def test_multiple_identical_ram_modules_sum_capacity_slots_and_power(configuration):
    configuration['components'][3].update(quantity=2)
    configuration['components'][3]['specs'].update(capacityGb=8, modules=1, power=4)
    result = evaluate(configuration)
    assert result.ram_gb == 16
    assert result.can_save
    assert result.total_price == 90000


def test_mixed_ram_exceeds_slots_even_when_each_product_fits(configuration):
    configuration['components'].append(component('ram', quantity=3, ram='DDR5', capacityGb=16, modules=1, power=4))
    result = evaluate(configuration)
    assert result.ram_gb == 80
    assert not result.can_save
    assert any('ranuras' in issue.message for issue in result.issues)


def test_gpu_manufacturer_psu_floor_is_not_ignored(configuration):
    configuration['components'][1]['specs']['minPsu'] = 700
    result = evaluate(configuration)
    assert result.recommended_watts == 700
    assert not result.can_save


@pytest.mark.parametrize('intended_use', ['oficina', 'estudio', 'gaming', 'programacion', 'edicion'])
@pytest.mark.parametrize('capacity', [8, 16])
def test_intended_use_only_adds_low_ram_warning(configuration, intended_use, capacity):
    configuration['components'][3]['specs'].update(capacityGb=capacity, modules=1)
    baseline = evaluate(configuration)
    configuration['intended_use'] = intended_use
    result = evaluate(configuration)
    expected = capacity < 16 and intended_use in {'gaming', 'programacion', 'edicion'}
    assert any('Para este uso' in issue.message for issue in result.issues) == expected
    assert result.ram_gb == capacity
    assert result.total_price == baseline.total_price
    assert result.can_save
    assert result.score == (90 if expected else 100)


def test_incomplete_api_specs_are_not_zero_or_full_compatibility(configuration):
    board = configuration['components'][2]['specs']
    board.pop('maxRam')
    board['unverified'] = ['capacidad RAM máxima']
    case = configuration['components'][6]['specs']
    for key in ['radiators', 'psuForms', 'fan120', 'fan140', 'included120', 'included140']:
        case.pop(key)
    case['unverified'] = ['formatos de fuente', 'radiadores y montaje simultáneo de ventiladores']
    result = evaluate(configuration)
    assert result.can_save
    assert result.level == 'Revisión parcial · confirmar montaje'
    assert any('por confirmar' in issue.message for issue in result.issues)
    assert not any('Faltan' in issue.message for issue in result.issues)
