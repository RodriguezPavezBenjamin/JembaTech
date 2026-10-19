"""Importación local acotada: una familia, hasta cinco consultas de ofertas.

Sin URLs libres, redirecciones, paginación ni reintentos. Nunca importa textos
comerciales o HTML del proveedor. Solo escritorio y fotos identificadas.
"""
import json
import re
from datetime import datetime, timezone
from http.client import HTTPException
from math import ceil
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, build_opener

from probe_solotodo import MAX_BYTES, NoRedirects, ProbeError
from solotodo import clean_text
from solotodo_prices import normalize_offers

TARGETS = {row['id']: row for row in json.loads(Path(__file__).with_name('catalog_scope.json').read_text())}
CAPS = {'cpu': 35, 'gpu': 30, 'ram': 20, 'board': 20, 'case': 15}
SOCKET_RAM = {'AM4': ['DDR4'], 'AM5': ['DDR5'], 'LGA1200': ['DDR4'], 'LGA1700': ['DDR4', 'DDR5'], 'LGA1851': ['DDR5']}
FORMS = {'ATX': 'ATX', 'Micro ATX': 'Micro-ATX', 'Micro-ATX': 'Micro-ATX', 'Mini ITX': 'Mini-ITX', 'Mini-ITX': 'Mini-ITX', 'Extended ATX': 'E-ATX'}


def product_url(target):
    limit = 25 if target['category'] == 'cpu' else 10
    ordering = '' if target['category'] == 'cpu' else '&ordering=-id'
    return f'https://api.solotodo.com/products/?categories={target["categoryId"]}&search={quote(target["query"], safe="")}{ordering}&page_size={limit}'


PRODUCT_URLS = {product_url(t) for t in TARGETS.values()}


def integer(value, minimum=1, maximum=1000000):
    if type(value) is not int or not minimum <= value <= maximum:
        raise ValueError('invalid_number')
    return value


def number(value):
    if type(value) not in (int, float) or not 0 < value <= 1000:
        raise ValueError('invalid_measurement')
    return value


def picture_url(value):
    if not isinstance(value, str) or not re.fullmatch(r'https://media\.solotodo\.com/media/products/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp|avif)', value):
        raise ValueError('missing_or_unsafe_picture')
    return value


def in_scope(category, name, specs):
    if re.search(r'notebook|laptop|port[aá]til|SO[ -]?DIMM|Xeon|Threadripper', name, re.IGNORECASE):
        return False
    if category == 'cpu':
        socket = str(specs.get('socket_unicode', '')).replace(' ', '')
        return socket in SOCKET_RAM and bool(re.search(r'Intel Core i[3579]-(?:11|12|13|14)\d{3}[FKST]*(?:\s|\[|$)|Intel Core Ultra [579] \d{3}[KFT]*(?:\s|\[|$)|AMD Ryzen [3579] [579]\d{3}(?:X3D2|X3D|XT|X|GE|GT|G|F)?(?:\s|\[|$)', name))
    if category == 'gpu':
        return bool(re.search(r'RTX [345]0[678]0|RX [679][0678]\d{2}', str(specs.get('gpu_unicode', ''))))
    if category == 'ram':
        return specs.get('bus_bus_bus_format_name') == 'DIMM' and specs.get('bus_bus_bus_type_name') in {'DDR4', 'DDR5'} and specs.get('capacity_total_capacity_value') in {8192, 16384, 32768, 65536}
    if category == 'board':
        return str(specs.get('chipset_northbridge_family_socket_unicode', '')).replace(' ', '') in SOCKET_RAM and specs.get('format_unicode') in FORMS and FORMS[specs['format_unicode']] != 'E-ATX' and specs.get('memory_slots_mtype_itype_type_name') in {'DDR4', 'DDR5'}
    return category == 'case' and specs.get('largest_motherboard_format_unicode') in FORMS


def connectors(rows, key):
    if not isinstance(rows, list):
        raise TypeError('missing_connectors')
    result = {'pcie8': 0, 'twelveV': 0}
    for row in rows:
        count = integer(row.get('quantity'), maximum=8)
        text = row.get(key, '')
        if text in {'8 pines', '6 pines'}:
            # El perfil PSU de 8 pines representa un cable PCIe 6+2.
            result['pcie8'] += count
        elif re.search(r'16 pines|12VHPWR|12V-2x6', text, re.IGNORECASE):
            result['twelveV'] += count
        else:
            raise ValueError('unsupported_connector')
    return result


def normalize_product(row, target):
    category = target['category']
    external_id = integer(row.get('id'))
    if row.get('category_id') != target['categoryId']:
        raise ValueError('wrong_category')
    name = clean_text(row.get('name', ''))
    if not name or len(name) > 200:
        raise ValueError('invalid_name')
    s = row.get('specs')
    if not isinstance(s, dict) or not in_scope(category, name, s):
        raise ValueError('out_of_desktop_scope')
    # Un filtro remoto ignorado nunca incorpora productos ajenos a la selección.
    if not all(re.sub(r'[^a-z0-9]', '', term.lower()) in re.sub(r'[^a-z0-9]', '', name.lower()) for term in target['query'].split()):
        raise ValueError('target_mismatch')
    image = picture_url(row.get('picture_url'))
    brand = clean_text(row['brand']['name'])
    part = row.get('part_number')
    if part is not None and (not isinstance(part, str) or len(part) > 120):
        raise ValueError('invalid_part_number')
    part = clean_text(part).strip() or None if part is not None else None
    specs = {'brand': brand}
    unknown = []
    if category == 'cpu':
        if brand not in {'AMD', 'Intel'} or not name.startswith(brand + ' '):
            raise ValueError('invalid_cpu_brand')
        socket = s['socket_unicode'].replace(' ', '')
        expected_socket = ('LGA1851' if 'Core Ultra' in name else 'LGA1200' if re.search(r'Core i[3579]-11', name) else 'LGA1700') if brand == 'Intel' else ('AM4' if re.search(r'Ryzen [3579] 5', name) else 'AM5')
        if socket != expected_socket:
            raise ValueError('cpu_platform_mismatch')
        cores = integer(s.get('core_count_value'), maximum=128) + integer(s.get('e_core_count_value', 0), minimum=0, maximum=128)
        threads = integer(s.get('thread_count_value'), maximum=256)
        if 'total_core_count' in s and s['total_core_count'] != cores:
            raise ValueError('inconsistent_cores')
        graphics, cooler = s.get('graphics_unicode'), s.get('cooler_unicode')
        if not isinstance(graphics, str) or not isinstance(cooler, str):
            raise ValueError('missing_graphics_or_cooler')
        tdp = number(s.get('tdp'))
        # Presupuesto manual explícito: no confundir TDP con máximo eléctrico.
        power = (300 if 'Core i9' in name or 'Ultra 9' in name else 253 if 'Core i7' in name or 'Ultra 7' in name else 200) if brand == 'Intel' else ceil(tdp * 1.5)
        integrated = not bool(re.search(r'no posee|no tiene|no incluye|sin gr[aá]fic|ningun', graphics, re.IGNORECASE))
        stock = not bool(re.search(r'no posee|no tiene|no incluye|sin cooler|ningun', cooler, re.IGNORECASE))
        if integrated and not re.search(r'UHD|Radeon|Intel Graphics|Iris|RDNA', graphics, re.IGNORECASE):
            raise ValueError('unknown_graphics')
        if stock and not re.search(r'cooler|Wraith', cooler, re.IGNORECASE):
            raise ValueError('unknown_cooler')
        if re.search(r'\b(?:Tray|WOF)\b', name, re.IGNORECASE) or (part or '').upper().endswith('WOF'):
            if stock:
                unknown.append('cooler de la presentación: no se considera incluido en Tray/WOF')
            stock = False
        specs.update(socket=socket, ramTypes=SOCKET_RAM[socket], cores=cores, threads=threads, integrated=integrated, stockCooler=stock, declaredTdpWatts=tdp, power=power)
        description = f'{socket} · {cores} núcleos / {threads} hilos · ' + ('gráfica integrada' if integrated else 'requiere gráfica dedicada')
    elif category == 'gpu':
        memory = integer(s.get('memory_quantity_value'), maximum=262144)
        length, tdp = number(s.get('length')), number(s.get('gpu_tdp'))
        specs.update(brand=s['gpu_brand_unicode'], manufacturer=brand, chip=s['gpu_unicode'], integrated=False, vramGb=memory / 1024, lengthMm=length, declaredTdpWatts=tdp, power=ceil(tdp * 1.25), **connectors(s.get('power_conns'), 'connector_unicode'))
        unknown.append('mínimo de fuente del ensamblador')
        description = f'{s["gpu_brand_unicode"]} · {memory / 1024:g} GB · {length:g} mm'
    elif category == 'ram':
        modules = integer(s.get('capacity_dimm_quantity_value'), maximum=4)
        total = integer(s.get('capacity_total_capacity_value'))
        if integer(s.get('capacity_dimm_capacity_value')) * modules != total:
            raise ValueError('inconsistent_kit')
        specs.update(ram=s['bus_bus_bus_type_name'], formFactor='DIMM', capacityGb=total // 1024, modules=modules, speed=integer(s.get('bus_frequency_value'), maximum=12000), power=modules * 4)
        rgb = s.get('has_rgb')
        if type(rgb) is bool:
            specs['rgb'] = rgb
        description = f'{specs["ram"]} · {specs["capacityGb"]} GB · {modules} módulos · {specs["speed"]} MT/s'
    elif category == 'board':
        ports = s.get('storage_ports')
        power_conns = s.get('power_connectors')
        if not isinstance(ports, list) or not isinstance(power_conns, list):
            raise ValueError('missing_ports')
        eps = 0
        for conn in power_conns:
            label = conn.get('connector_unicode', '')
            if 'CPU' in label:
                if not re.search(r'[48] pines', label):
                    raise ValueError('unsupported_eps')
                eps += integer(conn.get('quantity'), maximum=4)
        specs.update(socket=s['chipset_northbridge_family_socket_unicode'].replace(' ', ''), ram=s['memory_slots_mtype_itype_type_name'], form=FORMS[s['format_unicode']], chipset=s['chipset_unicode'], ramSlots=integer(s.get('memory_slots_quantity'), maximum=8), m2=sum(integer(p.get('quantity'), maximum=16) for p in ports if str(p.get('port_connector_name', '')).startswith('M.2')), sata=sum(integer(p.get('quantity'), maximum=16) for p in ports if p.get('port_connector_name') == 'SATA'), cpuEps=eps, power=45)
        unknown += ['capacidad RAM máxima', 'red y Wi-Fi', 'BIOS/QVL y puertos compartidos']
        description = f'{specs["socket"]} · {specs["ram"]} · {specs["form"]} · {specs["ramSlots"]} slots RAM'
    else:
        if s.get('power_supply_power') != 0:
            raise ValueError('case_psu_included_or_unknown')
        form = FORMS[s['largest_motherboard_format_unicode']]
        forms = ['Mini-ITX', 'Micro-ATX', 'ATX'][:{'Mini-ITX': 1, 'Micro-ATX': 2, 'ATX': 3, 'E-ATX': 3}[form]]
        # Compatibilidad de formatos menores es orientativa; no se publica E-ATX
        # sin límite de ancho ni se deduce radiador a partir de ventiladores.
        specs.update(forms=forms, gpuClearanceMm=number(s.get('max_video_card_length')), coolerClearanceMm=number(s.get('max_cpu_cooler_height')), bays25=integer(s.get('internal_2_1_2_bays'), minimum=0, maximum=30), bays35=integer(s.get('internal_3_1_2_bays'), minimum=0, maximum=30))
        included = s.get('included_fans')
        if isinstance(included, list) and all(f.get('fan_mm') in (120, 140) for f in included):
            specs.update(included120=sum(integer(f.get('quantity'), maximum=16) for f in included if f['fan_mm'] == 120), included140=sum(integer(f.get('quantity'), maximum=16) for f in included if f['fan_mm'] == 140))
        unknown += ['formatos de fuente', 'radiadores y montaje simultáneo de ventiladores', 'confirmar formatos de placa admitidos']
        if 'included120' not in specs:
            unknown.append('ventiladores incluidos')
        for key, api in [('color', 'color_unicode'), ('sidePanel', 'side_panel_unicode'), ('caseSize', 'size_unicode')]:
            if isinstance(s.get(api), str):
                specs[key] = clean_text(s[api])[:80]
        description = f'{" / ".join(forms)} · {specs.get("color", "color según ficha")} · GPU hasta {specs["gpuClearanceMm"]:g} mm'
    specs['unverified'] = unknown
    specs['mountNote'] = 'Ficha API SoloTodo. Consumo: presupuesto de planificación, no medición ni máximo certificado. Confirmar presentación y montaje.' + ((' Por revisar: ' + '; '.join(unknown) + '.') if unknown else '')
    if part:
        specs['partNumber'] = clean_text(part)
    return {'id': f'solotodo-{category}-{external_id}', 'externalId': external_id, 'category': category, 'name': name, 'description': description, 'image': image, 'specs': specs, 'partNumber': part}


def fetch_json(url):
    if url not in PRODUCT_URLS and not re.fullmatch(r'https://publicapi\.solotodo\.com/entities/\?products=[1-9][0-9]{0,5}&is_available=1&page_size=5', url):
        raise ProbeError('invalid_target')
    request = Request(url, headers={'Accept': 'application/json', 'User-Agent': 'JembaTech-EP2-catalog/0.1 (educational; bounded on-demand)'})
    try:
        with build_opener(NoRedirects()).open(request, timeout=10) as response:
            if response.status != 200 or response.headers.get_content_type() != 'application/json':
                raise ProbeError('invalid_source_contract')
            body = response.read(MAX_BYTES + 1)
            if len(body) > MAX_BYTES:
                raise ProbeError('response_too_large')
        payload = json.loads(body)
        limit = 25 if url in PRODUCT_URLS and 'page_size=25' in url else 10 if url in PRODUCT_URLS else 5
        if not isinstance(payload, dict) or not isinstance(payload.get('results'), list) or len(payload['results']) > limit:
            raise ProbeError('invalid_source_contract')
        return payload['results']
    except HTTPError as error:
        error.close()
        raise ProbeError('source_rate_limited' if error.code == 429 else 'source_access_denied' if error.code in (401, 403) else 'source_http_error') from error
    except (URLError, TimeoutError, OSError, HTTPException) as error:
        raise ProbeError('source_unavailable') from error
    except (ValueError, TypeError) as error:
        raise ProbeError('invalid_source_contract') from error


def recover_catalog(target_id):
    if target_id not in TARGETS:
        raise ProbeError('invalid_target')
    target = TARGETS[target_id]
    url = product_url(target)
    rows = fetch_json(url)
    candidates, products, issues, seen = [], [], [], set()
    for index, row in enumerate(rows):
        try:
            product = normalize_product(row, target)
            if product['externalId'] in seen:
                raise ValueError('duplicate_id')
            seen.add(product['externalId'])
            candidates.append((index, product))
        except (ValueError, TypeError, KeyError, AttributeError):
            issues.append({'index': index, 'code': 'invalid_or_out_of_scope'})
    # Cotizar antes de aplicar cuota evita que variantes sin ofertas la consuman.
    # El buscador remoto puede coincidir por descripciones. Dar prioridad al
    # nombre exacto/presentación retail antes de consultar hasta cinco ofertas.
    candidates.sort(key=lambda pair: (not bool(re.search(re.escape(target['query']) + r'(?=\s|\[|$)', pair[1]['name'], re.IGNORECASE)), bool(re.search(r'\bTray\b', pair[1]['name'], re.IGNORECASE))))
    attempted = 0
    for index, product in candidates:
        if len(products) >= target['take'] or attempted >= 5:
            issues.append({'index': index, 'code': 'target_quota' if len(products) >= target['take'] else 'candidate_limit'})
            continue
        attempted += 1
        product_id = product['externalId']
        price_url = f'https://publicapi.solotodo.com/entities/?products={product_id}&is_available=1&page_size=5'
        offers = fetch_json(price_url)
        stamp = datetime.now(timezone.utc)
        prices = {'schemaVersion': 'solotodo-prices-1', 'target': product['id'], 'productId': product_id, 'sourceRequestUrl': price_url, 'retrievedAt': stamp.isoformat(), 'currency': 'CLP', 'scope': 'first-page', **normalize_offers(offers, product_id, stamp)}
        if not prices['offers']:
            issues.append({'index': index, 'code': 'no_eligible_offer'})
            continue
        products.append({**product, 'prices': prices})
    return {'schemaVersion': 'solotodo-catalog-3', 'target': target_id, 'sourceRequestUrl': url, 'retrievedAt': datetime.now(timezone.utc).isoformat(), 'received': len(rows), 'products': products, 'issues': issues}
