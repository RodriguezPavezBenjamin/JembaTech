"""Placas, kits de RAM y discos: fixtures sintéticas, sin peticiones al proveedor."""

from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from main import app
from solotodo_components import ComponentBatch, normalize_component_batch

STAMP = '2026-01-01T12:00:00Z'


def record(category_id, specs, name='Componente QA'):
    return {'id': 456, 'category_id': category_id, 'name': name, 'brand': {'name': 'Marca QA'},
            'part_number': 'QA-ONLY', 'specs': specs}


def board():
    return record(5, {'chipset_northbridge_family_socket_unicode': 'AM5', 'chipset_unicode': 'AMD B650',
                      'format_unicode': 'Micro ATX', 'memory_slots_mtype_itype_type_name': 'DDR5',
                      'memory_slots_quantity': 4,
                      'storage_ports': [{'quantity': 1, 'port_connector_name': 'M.2 22110'},
                                        {'quantity': 1, 'port_connector_name': 'M.2 2280'},
                                        {'quantity': 4, 'port_connector_name': 'SATA'}]})


def ram():
    return record(7, {'capacity_total_capacity_value': 32768, 'capacity_dimm_capacity_value': 16384,
                      'capacity_dimm_quantity_value': 2, 'bus_bus_bus_type_name': 'DDR5',
                      'bus_bus_bus_format_name': 'DIMM', 'bus_frequency_value': 6000, 'latency_cl_value': 30})


def ssd():
    return record(39, {'capacity_value': 1000, 'ssd_type_bus_bus_with_version_bus_name': 'PCIe',
                       'ssd_type_bus_unicode': 'PCIe 4.0 x4', 'ssd_type_format_unicode': 'M.2 (2280)',
                       'ssd_type_connector_unicode': 'M.2 2280', 'sequential_read_speed': 6000,
                       'sequential_write_speed': 4000}, name='Kingston NV3 QA')


def hdd():
    return record(8, {'capacity_value': 2000, 'type_name': 'HDD', 'bus_bus_bus_with_version_bus_name': 'SATA',
                      'bus_unicode': 'SATA 3', 'size_unicode': '3.5"', 'rpm_value': 7200})


def normalize(category, rows, terms=()):
    return normalize_component_batch(ComponentBatch(category=category, retrieved_at=STAMP, results=rows), terms)


def test_board_uses_slots_and_sums_connector_quantities_not_text_or_buses():
    p = normalize('motherboard', [board()])['products'][0]
    assert p['specs'] == {'socket': 'AM5', 'chipset': 'AMD B650', 'formFactor': 'Micro ATX',
                          'ramType': 'DDR5', 'ramSlots': 4, 'm2Slots': 2, 'sataPorts': 4, 'declaredTdpWatts': None}
    row = board()
    del row['specs']['storage_ports']
    assert normalize('motherboard', [row])['products'][0]['specs']['m2Slots'] is None
    row['specs']['storage_ports'] = []
    assert normalize('motherboard', [row])['products'][0]['specs']['m2Slots'] == 0


def test_ram_capacity_is_per_kit_and_per_module_with_matching_totals():
    result = normalize('ram', [ram()])
    assert result['products'][0]['specs'] == {'capacityGb': 32, 'moduleCapacityGb': 16, 'modules': 2,
                                            'ramType': 'DDR5', 'formFactor': 'DIMM', 'speedMt': 6000,
                                            'casLatency': 30, 'declaredTdpWatts': None}
    assert result['metrics']['missing_tdp'] == 0
    row = ram()
    row['specs'].update(bus_bus_bus_type_name='DDR4', bus_frequency_value=3200)
    del row['specs']['latency_cl_value']
    assert normalize('ram', [row])['products'][0]['specs']['casLatency'] is None


def test_storage_keeps_commercial_gb_distinct_from_ram_and_never_infers_nvme():
    p = normalize('storage', [ssd()])['products'][0]
    assert p['specs']['capacityGb'] == 1000
    assert p['specs']['interface'] == 'PCIe'
    assert p['specs']['formFactor'] == 'M.2 (2280)'
    assert p['specs']['protocol'] is None
    assert p['specs']['rpm'] is None
    sata = ssd()
    sata['specs'].update(ssd_type_bus_bus_with_version_bus_name='SATA', ssd_type_bus_unicode='SATA 3')
    p = normalize('storage', [sata])['products'][0]
    assert p['specs']['interface'] == 'SATA' and p['specs']['formFactor'] == 'M.2 (2280)'
    assert p['specs']['protocol'] is None  # M.2 no cambia SATA por NVMe.
    p = normalize('storage', [hdd()])['products'][0]
    assert p['specs']['storageType'] == 'HDD' and p['specs']['rpm'] == 7200
    assert p['specs']['capacityGb'] == 2000 and p['specs']['readMbps'] is None


@pytest.mark.parametrize('category,factory,field,value', [
    ('motherboard', board, 'memory_slots_quantity', True),
    ('motherboard', board, 'memory_slots_quantity', 0),
    ('motherboard', board, 'memory_slots_mtype_itype_type_name', 'DDR3'),
    ('motherboard', board, 'format_unicode', '<svg>'),
    ('motherboard', board, 'storage_ports', [{'quantity': True, 'port_connector_name': 'SATA'}]),
    ('ram', ram, 'capacity_dimm_quantity_value', 3),
    ('ram', ram, 'capacity_total_capacity_value', '32768'),
    ('ram', ram, 'bus_frequency_value', True),
    ('ram', ram, 'latency_cl_value', -1),
    ('storage', ssd, 'capacity_value', 0),
    ('storage', ssd, 'capacity_value', '1000'),
    ('storage', ssd, 'sequential_read_speed', True),
    ('storage', ssd, 'ssd_type_bus_bus_with_version_bus_name', None),
    ('storage', hdd, 'type_name', 'SSD'),
    ('storage', hdd, 'rpm_value', -1),
])
def test_invalid_rows_do_not_replace_a_valid_component(category, factory, field, value):
    row = factory()
    row['specs'][field] = value
    good = factory()
    good['id'] = 457
    result = normalize(category, [row, good])
    assert result['metrics']['rejected'] == 1
    assert result['metrics']['accepted'] == 1


@pytest.mark.parametrize('category,factory', [('motherboard', board), ('ram', ram), ('storage', ssd), ('storage', hdd)])
def test_category_dates_deduplication_and_hash(category, factory):
    row = factory()
    bad = deepcopy(row)
    bad['category_id'] = 3
    result = normalize(category, [bad, row, row])
    assert result['metrics']['rejected'] == 1 and result['metrics']['duplicates'] == 1
    assert result['metrics']['missing_tdp'] == 0
    first_hash = result['products'][0]['content_hash']
    row['description'] = 'never copy'
    assert normalize(category, [row])['products'][0]['content_hash'] == first_hash
    row['last_updated'] = '2099-01-01T00:00:00Z'
    assert normalize(category, [row])['metrics']['rejected'] == 1


def test_fuzzy_search_mismatches_are_audited_not_stored_or_retried():
    row = ssd()
    row['name'] = 'Samsung 970 Evo Plus'
    result = normalize('storage', [row], ('Samsung', '990'))
    assert result['products'] == []
    assert result['metrics']['received'] == 1 and result['metrics']['rejected'] == 1
    assert result['issues'][0]['code'] == 'target_mismatch'
    row['name'] = 'Samsung 990 PRO 2 TB'
    assert normalize('storage', [row], ('Samsung', '990'))['metrics']['accepted'] == 1
    # Ambas categorías externas son almacenamiento, pero no son intercambiables.
    batch = ComponentBatch(category='storage', retrieved_at=STAMP, results=[ssd()])
    assert normalize_component_batch(batch, expected_category_id=8)['metrics']['rejected'] == 1


def test_endpoint_accepts_only_supported_category_contracts_without_network():
    client = TestClient(app)
    for category, factory in [('motherboard', board), ('ram', ram), ('storage', ssd)]:
        response = client.post('/sources/solotodo/components/normalize', json={'category': category, 'retrieved_at': STAMP, 'results': [factory()]})
        assert response.status_code == 200 and response.json()['metrics']['accepted'] == 1
    assert client.post('/sources/solotodo/components/normalize', json={'category': 'psu', 'retrieved_at': STAMP, 'results': []}).status_code == 422
