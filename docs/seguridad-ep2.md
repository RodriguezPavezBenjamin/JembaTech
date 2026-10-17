# Seguridad y pipeline EP2

Actualizado: 2026-10-17. Implementación local; el resultado de Actions requiere commit/push. No acredita staging ni ausencia total de vulnerabilidades.

## Política de controles

| Control | Alcance y bloqueo |
|---|---|
| CodeQL `security-extended` | Angular/NestJS y Python de producción. SARIF publicado y gate adicional `security-severity >= 7`; fallo si faltan reportes/reglas o el análisis no terminó. |
| Bandit 1.9.4 | Python de producción, sin fixtures. Cualquier hallazgo bloquea; sin exclusiones globales de reglas. |
| pip-audit 2.10.1 | Runtime Python y transitivas; cualquier vulnerabilidad conocida. `--strict` rechaza errores de recopilación. |
| npm audit producción | HIGH/CRITICAL bloqueantes en frontend/backend. |
| npm audit completo | Incluye desarrollo; CRITICAL bloqueantes, HIGH/MODERATE también quedan reportados. |
| TruffleHog | Control existente de secretos `verified,unknown`, ahora fijado por SHA. |
| Trivy 0.76.0 | IDs reales de frontend, backend, Python, migraciones y PostgreSQL. Falla ante error, cualquier CRITICAL (con o sin parche) y HIGH con solución disponible. |

Trivy exporta un JSON **completo**, también con severidades menores y CVE sin parche. El gate CRITICAL no usa `--ignore-unfixed`; esa opción solo se aplica al gate separado de HIGH. Pasar el umbral no significa ausencia de CVE. No se añaden excepciones por CVE para obtener verde.

Corrección de alineamiento: el bloqueo de CRITICAL sin parche se incorpora antes del commit de validación. Las pruebas simuladas comprueban que ese hallazgo bloquea y que se escanean los otros servicios. Un resultado remoto rojo requiere tratar el hallazgo, no relajar el control. Ver [cierre EP2](cierre-ep2.md).

Verificación adicional del corte de fuente/cierre: 7 pruebas Node de CodeQL, salud y autorización del script de evaluación aprobadas; 5 pruebas del gate Bash aprobadas, incluida CRITICAL sin parche. Se repitió la prueba de salud con permiso de conexión local tras un bloqueo `EACCES` del sandbox; no fue un fallo de la aplicación. No se presenta esta prueba simulada como un escaneo Trivy nuevo ni como Actions remoto aprobado.

Artifacts conservados 14 días, también ante fallos. Permisos mínimos; solo CodeQL recibe `security-events: write`. Acciones nuevas de seguridad y detector de secretos fijados por SHA; herramientas Python fijadas en `requirements-security.txt`, fuera del runtime. CodeQL completo queda pendiente de GitHub: probar el lector SARIF no equivale a ejecutar el analizador.

## Parches aplicados

- Angular runtime/compiler-cli 20.3.34 y build/CLI 20.3.40; se conserva Angular 20.
- NestJS platform-express desde 11.2.7, Multer 2.4.0. Prisma/cliente 6.19.3, sin migrar a Prisma 7.
- Override `deepmerge-ts` 8.0.2 solo bajo `@prisma/config`: corrige recursión y exige comprobar generación, migración e integración. Retirarlo cuando el proveedor incorpore la corrección.
- Override `js-yaml` 5.5.0 solo bajo Swagger.
- Vitest sigue en 3, requerido por Angular 20. Override Tinypool 2.1.2 compatible con Node 22; suite completa comprobada. No usar Node 18.
- FastAPI 0.143.3 y Starlette 1.8.0. Pydantic 2.11.3 y contratos conservados; verificados con tests e integración.
- Nginx 1.30; bases actualizadas con `build --pull`, PostgreSQL sigue en 16.
- Imagen derivada de PostgreSQL 16 Alpine: sustituye el helper Go `gosu` 1.19 por `su-exec` del repositorio Alpine. Se adapta una sola línea del entrypoint y el build falla si cambia ese contrato; se conserva bajada de privilegios, señales y datos. Se elimina el binario, sin alias que conserve metadatos del scanner ni excepciones de CVE. Debe probarse inicio con volumen nuevo, reinicio/persistencia e integración antes de actualizar una base en uso.
- Migraciones usan target runtime, no build con Jest/compiladores. npm/npx se eliminan del runtime; Prisma se ejecuta con `node node_modules/prisma/build/index.js migrate deploy`.
- Correcciones npm adicionales dentro de rangos actuales, sin `--force` ni desactivar validación de peers.

Los overrides son cambios explícitos de dependencias, no exclusiones del auditor. Aún hay HIGH/MODERATE en herramientas de desarrollo; no se declara la auditoría completa limpia ni se migra silenciosamente Jest/Angular a otra versión mayor.

## Reproducción

```bash
mkdir -p reports
node --test tests/security/*.test.mjs
cd python-service
pip install -r requirements-security.txt
python -m bandit -r . -x ./tests -f json -o ../reports/bandit.json
python -m pip_audit --strict -r requirements.txt -f json -o ../reports/pip-audit.json
```

Con Compose iniciado y Trivy instalado: `bash scripts/scan-images.sh`. Los informes locales de `reports/` se excluyen de Git. Comprobar la salud con `node scripts/check-health.mjs`: frontend, proxy `/api`, NestJS, FastAPI y PostgreSQL, no solo HTTP 200. Admite `TEST_API_URL`, `TEST_FRONTEND_URL` y `TEST_PYTHON_URL`; no imprime cuerpos ni credenciales ante error.

La verificación local usa el proyecto Compose **jembatech-ep2-security**, override `tests/security/compose.test.yml`, puertos 14200/13000/18000/15432 y volumen propio. La contraseña literal es solo QA local. SoloTodo queda desactivado y las integraciones usan datos temporales; no reutilizar ese override en staging. No modifica cotizaciones reales.

## Evidencia y límites

- Python actualizado: 72 pruebas, Bandit sin hallazgos y pip-audit sin vulnerabilidades conocidas en el runtime resuelto. Aviso de deprecación del cliente HTTP de tests, no fallo.
- Gate SARIF y health: 4 pruebas; rechazan análisis incompleto y base caída que responde HTTP 200.
- actionlint 1.7.7 comprueba sintaxis/expresiones y scripts incrustados de Actions.
- Ambiente QA: migraciones runtime, 6 comprobaciones de cotizador e integraciones de muestras/recuperación y health aprobadas; sin consultas a SoloTodo.
- Imágenes finales: las cinco pasan el gate Trivy HIGH/CRITICAL con parche. Informes completos: frontend/backend/migraciones/base tienen 1 hallazgo menor cada una; Python tiene 172 hallazgos de paquetes, incluidos 44 HIGH sin solución publicada. No son 172 CVE distintos ni una imagen libre de riesgos. Revisar los informes y volver a construir/escanear cuando el proveedor publique parches.
- npm completo: frontend 19 paquetes afectados (12 HIGH, 7 MODERATE); backend 34 (29 HIGH, 5 MODERATE), sin CRITICAL. Estos contadores incluyen cadenas transitivas de herramientas, no avisos únicos. Runtime npm de ambos proyectos: sin vulnerabilidades conocidas en la auditoría de este corte.
- Imagen PostgreSQL: inicio vacío no root aprobado, registro QA conservado tras sustituir la imagen y migraciones con Prisma directo aprobadas. La base real no se reinició; estos cambios de contenedores se verificaron solo en QA.
- Script de imágenes: 4 tests simulados sin red validan éxito, hallazgo bloqueante, error de scanner e imagen ausente; los errores no se interpretan como aprobación y se siguen revisando los otros servicios.
- Pendientes: cerrar ejecución remota de CodeQL/Actions, triage del toolchain, observabilidad global, despliegue automatizado y health posterior a staging. Compose en CI no es staging.

## Fuentes técnicas

[CodeQL oficial](https://docs.github.com/en/code-security/reference/code-scanning/workflow-configuration-options), [Trivy](https://github.com/aquasecurity/trivy), [pip-audit](https://pypi.org/project/pip-audit/), [Bandit](https://bandit.readthedocs.io/en/latest/).
