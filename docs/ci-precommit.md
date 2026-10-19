# Validación local antes del próximo commit — 18/10/2026

HEAD continúa en `68a0b0d`. El usuario hará el commit y push. Este documento registra comprobaciones locales del árbol de trabajo; no certifica un nuevo run de GitHub Actions ni un despliegue Railway.

## Cambios de CI y seguridad

Se conservan triggers push/pull_request/workflow_dispatch, permisos, nueve ejecuciones de jobs (CodeQL usa una matriz de dos lenguajes), gates y artifacts con retención de 14 días. Node de la aplicación sigue en 22 y Python en 3.12.

Las cuatro acciones se comprobaron contra sus tags oficiales, se revisaron sus cambios y se verificó `using: node24` en cada `action.yml`:

| Acción | Versión | SHA fijado |
| --- | --- | --- |
| checkout | 7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| setup-node | 7.1.0 | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| setup-python | 7.0.0 | `5fda3b95a4ea91299a34e894583c3862153e4b97` |
| upload-artifact | 7.0.2 | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` |

Se revisaron ESM, credenciales checkout, eliminación del token npm ficticio y compatibilidad del runner. El workflow no usa registry-url, pip-install, triggers privilegiados de forks ni autenticación Git desde un contenedor. Los ocho jobs fijan `ubuntu-24.04`; las nuevas acciones requieren runners actualizados de GitHub, no instalaciones locales.

Fuentes: [checkout](https://github.com/actions/checkout/releases/tag/v7.0.1), [setup-node](https://github.com/actions/setup-node/releases/tag/v7.1.0), [setup-python](https://github.com/actions/setup-python/releases/tag/v7.0.0), [upload-artifact](https://github.com/actions/upload-artifact/releases/tag/v7.0.2).

El escaneo real de la imagen frontend detectó dos HIGH con parche: `CVE-2026-77214` en libexpat 2.8.5-r0 y `CVE-2026-88806` en libx11 1.8.13-r0. Se añadió `apk upgrade --no-cache libexpat libx11` a la etapa final Nginx: versiones observadas después, 2.9.0-r0 y 1.8.14-r0. No se modificaron severidades, excepciones ni gates para obtener aprobación.

Se añadió el checksum `h1` oficial Linux del proveedor Terraform local 2.9.1, conservando el de Windows y los hashes ZIP. Obtenido con `terraform providers lock -platform=linux_amd64 -platform=windows_amd64`, firmado por HashiCorp. No se cambió la versión del proveedor. [Documentación de bloqueo multiplataforma](https://developer.hashicorp.com/terraform/cli/commands/providers/lock).

## Resultados locales

| Control | Resultado y alcance |
| --- | --- |
| Workflow | actionlint 1.7.7 aprobado, sin ShellCheck/Pyflakes. Cinco controles estáticos de política CI añadidos al job frontend. |
| Frontend | ESLint, 69 pruebas en ocho archivos y build Angular aprobados. |
| Backend | ESLint, generación Prisma, 139 pruebas en once suites y build NestJS aprobados. La generación del cliente no ejecuta migraciones. |
| Node | 54 controles de documento, Android, política CI y seguridad aprobados. |
| Python | Ruff, 198 pruebas y Bandit aprobados en copia temporal sin red. Diez pruebas de scripts Bash adicionales aprobadas. Un aviso de deprecación del TestClient permanece. |
| npm | Producción: cero vulnerabilidades reportadas en ambos proyectos. Auditoría completa: umbral CRITICAL aprobado; frontend mantiene 19 paquetes afectados (12 HIGH/7 MODERATE) y backend 34 (29 HIGH/5 MODERATE), de herramientas/transitivas. No se ejecutó audit fix --force ni se hicieron saltos mayores para ocultarlos. |
| Python dependencias | pip-audit --strict del requirements de producción y transitivas: sin vulnerabilidades conocidas en este corte. |
| Docker QA | Cinco imágenes construidas con --pull; migraciones en base vacía propia. Seis pruebas del cotizador aprobadas; fuentes, recuperación, precios e importación aprobados con fixtures sintéticas. No hubo solicitudes a SoloTodo. |
| Observabilidad y salud QA | Nginx → NestJS → FastAPI, roles, errores y tres solicitudes correlacionadas aprobados; sin marca privada filtrada. Salud frontend/proxy/backend/Python/PostgreSQL aprobada. |
| PostgreSQL | Inicio vacío efímero, usuario no root y consulta aprobados. |
| Trivy | Cinco imágenes finales aprobadas: cero CRITICAL y cero HIGH con parche. Informes completos conservados; no equivale a ausencia de riesgos. |
| Git | diff --check sin errores; archivos locales, credenciales, APK, cachés e informes siguen ignorados. No se hizo stage, commit ni push. |

Los fallos iniciales por sandbox/localhost se repitieron con acceso adecuado. El primer Terraform con lockfile readonly necesitó incorporar el checksum Linux; la repetición con checksums oficiales aprobó init readonly, fmt, validate y plan. No se ejecutó apply ni se crearon recursos cloud. Un escaneo local solapado con una reconstrucción perdió el ID de imagen anterior; se repitió completo después de estabilizar las imágenes, con éxito. Ninguno de estos intentos fallidos se cuenta como aprobación.

Reportes completos locales: `reports/security/precommit-20261018/`, ignorados por Git. Trivy: frontend 2 hallazgos no bloqueantes; backend/migrate/database 1 cada uno; Python 172 hallazgos de paquetes, incluidos 44 HIGH sin solución publicada. No son necesariamente CVE distintos. Los gates de CI siguen bloqueando CRITICAL incluso sin parche y HIGH con solución.

El entorno `jembatech-precommit-20261018` utilizó puertos y volumen propios y credenciales aleatorias no impresas. Se retiraron solo sus contenedores, red y volumen QA al terminar; los tres contenedores locales originales siguieron activos y la base original saludable. No se tocaron cotizaciones reales ni se reiniciaron servicios existentes.

Android: APK debug, prueba unitaria y lint nativo ya aprobados; portada confirmada en emulador. El usuario confirmó flujos manuales tanto web como Android. Es evidencia manual reportada, no una suite instrumentada ejecutada. [Detalle](android-validacion.md).

## Comandos para el usuario

Este corte **sí incluye Android**; sustituye la exclusión histórica de la preparación anterior. La selección incorpora el avance de catálogo, portada, Android y CI que ya está en el árbol de trabajo. Revisar el resumen antes de confirmar:

```powershell
Set-Location "S:\Accesos SSD\Desktop\WEB ADVANCED\Primera entrega"
git diff --check
git add -- .github README.md backend docs frontend infra python-service scripts tests
git diff --cached --check
git diff --cached --stat
git commit -m "feat(ep2): integra catálogo, portada, Android y CI"
git push origin main
```

No subir `.env`, `local.properties`, `.idea`, APK/AAB, cachés o `reports/`. No se excluye la plataforma Android versionada.

Después del push revisar el run del **nuevo SHA**, incluidos CodeQL y el escaneo real de secretos Git, que no se ejecutaron nuevamente sobre un commit todavía inexistente. Las pruebas del gate SARIF/secretos no sustituyen los escáneres reales. Ni las pruebas locales ni el run anterior garantizan el resultado remoto: nuevos hallazgos o cambios del proveedor pueden bloquear correctamente.

Railway/staging, prueba contra la URL pública, release EP2 y ensayo final permanecen pendientes. No crear ni mover tags/releases hasta identificar el commit aprobado y desplegado. Los cambios de runtime de Actions no despliegan la aplicación.
