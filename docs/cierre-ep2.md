# Cierre y demostración EP2

## Estado vigente, 2026-10-19

Staging Railway existe en https://jembatech.up.railway.app. El usuario confirmó
Google, rol ADMIN y solicitud/respuesta vista por CLIENT; CI #13 verde para
1a1279b según su captura. Posteriormente CD y salud completa de `c4dd5dd` quedaron
aprobados según el artifact aportado; Terraform adoptó 16 objetos con plan real
sin cambios ni diferencias observadas. [Evidencia](adopcion-railway-evidencia.md).
No repetir la selección/creación de alojamiento ni las importaciones.

El usuario confirmó además las [cinco referencias reales en Angular de staging](muestra-staging-ep2.md),
trasladadas desde la corrida local como muestra declarada, sin nueva adquisición
API. Sus fechas, procedencia, antigüedad y limitaciones permanecen visibles.

El propietario confirmó la revocación del token temporal; se conserva el de CD.
Revisión contra la pauta original (pp. 17–18 y 35–40) repetida en este corte.
[Mapa de evidencia y límites](revision-pauta-ep2.md).

Pendientes reales, en orden:

1. Revisar la cobertura IaC: los 16 objetos modelados están adoptados, pero los
   ajustes no soportados por el proveedor requieren mecanismo de reproducción
   o una limitación expresamente evaluada contra la pauta.
2. Preparar la presentación de la métrica histórica y el error controlado de QA,
   distinguiéndolos de la muestra ya visualizada en staging; mantener límites,
   derechos y flag público desactivado. No repetir la extracción ni la carga.
3. Publicar los cambios locales y validar su propia CI/CD; conservar artifacts,
   completar documentación/datos reales, enlaces y ensayo.
4. Tag/release EP2 solo del SHA final validado/desplegado; conservar EP1.

La recuperación/vinculación más ágil de cuentas se pospone por decisión del
usuario. No se cambian roles ni se fusionan cuentas para cerrar infraestructura.

### Validación local antes de publicar este corte

- 89 pruebas Node de seguridad, CD, inventario, imports, plan y política CI:
  aprobadas. Las pruebas de salud usan localhost; se ejecutaron con el acceso
  necesario después de los bloqueos del aislamiento de cortes anteriores.
- `terraform fmt -check -recursive infra/railway`: aprobado con Terraform 1.16.4.
- actionlint 1.7.7: ambos workflows aprobados, sin ShellCheck/Pyflakes adicionales.
- TruffleHog 3.99.2 fijado por digest, sin red/verificación, sobre copia de los
  23 archivos modificados/nuevos: diez alertas RailwayApp, todas comparadas en
  memoria y coincidentes exactamente con los IDs públicos de proyecto, entorno
  o servicios ya confirmados; cero alertas de otros valores. No se imprimió Raw.
  No se cambió la baseline, no se excluyeron detectores/archivos ni se relajó CI.
  Esto no sustituye el escaneo Git remoto con verificación ni acredita ausencia
  general de secretos en el historial.
- `git diff --check`: aprobado. Muestra, registros y copia de QA siguen en
  `reports/`, ignorados; estado/planes cifrados no están en el repositorio.

No se hizo commit/push/tag. El siguiente commit todavía debe aprobar su CI/CD
real; el resultado de `c4dd5dd` no se transfiere a estos cambios locales.

## Registro histórico anterior

Actualizado: 2026-10-18. Lista local de preparación y [tablero Markdown](tablero-ep2.md), según aclaración del usuario; no se creó un tablero remoto ni se acredita cierre final. Las cifras remiten a sus cortes de verificación; la ampliación privada más reciente se detalla en [componentes](fuente-web-componentes.md).

## Estado y orden de cierre

| Prioridad | Tarea | Criterio de cierre / estado |
| --- | --- | --- |
| 1 | Elegir infraestructura de staging | Pendiente. El usuario no tiene alojamiento elegido. Consultar disponibilidad institucional/créditos antes de comprometer servicios o costes. |
| 2 | Fuente útil para el cotizador | [Importador local del armador](catalogo-solotodo.md): CPU, GPU, RAM, placas y gabinetes con foto identificada, oferta CLP y caducidad; datos de montaje ausentes generan revisión parcial. Conserva las cotizaciones y los ocho mapeos anteriores. Cobertura limitada y condiciones de uso/publicación pendientes; no sincronización pública/recurrente. |
| 3 | Desplegar los cuatro bloques desde Actions | Pendiente: frontend, NestJS, FastAPI y PostgreSQL, con versión identificable, HTTPS y servicios internos protegidos. |
| 4 | Verificar seguridad y salud del despliegue | CI EP2 #7 aprobado para `68a0b0d`, incluidos Docker y controles. Faltan revisión/conservación de reportes y salud posdespliegue de staging. |
| 5 | Documentación y diseño preliminar | Arquitectura/modelo/diagramas actualizados y diseño adaptativo especificado. Falta completar datos reales de staging y evidencias finales. |
| 6 | Seguimiento del proyecto | Tablero local actualizado con tareas realizadas, validaciones y pendientes. |
| 7 | Ensayar demo y etiquetar versión | Guion abajo. Tag/release EP2 solo después de validar el commit final desplegado; no reutilizar la release EP1. |

## Staging: requisito y decisión pendiente

La pauta local `ProyectoFinal .pdf` pide despliegue automatizado funcional en staging y salud posterior en EP2 (pp. 38–39). Los requisitos generales de despliegue incluyen frontend, NestJS, Python, PostgreSQL, configuración y registros, con una versión identificable (p. 18); infraestructura reproducible con Terraform (pp. 17–18). No se fija un proveedor comercial concreto en esos apartados.

Staging es un ambiente de prueba separado, accesible para la revisión docente. GitHub Pages sirve el frontend estático, pero por sí solo no ejecuta NestJS/FastAPI/PostgreSQL y no demuestra ese despliegue completo. Los contenedores de CI también son temporales: un test verde no crea una URL de staging.

Antes de implementar el despliegue se necesita confirmar:

- Servidor/recursos de la universidad o, si no existen, proveedor y cuenta que el usuario autorice. Comprobar costes, límites y disponibilidad actuales antes de elegir; no se presupone un plan gratuito suficiente.
- Acceso para despliegue automatizado, dominio o URL con HTTPS y persistencia de PostgreSQL. No usar una cuenta personal de terceros ni compartir claves en el chat.
- Secrets para credenciales y Variables para configuración no sensible. Terraform con estado protegido fuera de Git y `apply` controlado.
- Imágenes identificadas por commit/digest, migraciones controladas, backups y estrategia básica de rollback. Volver a una imagen no deshace por sí solo una migración incompatible.
- Ruta de salud pública mínima y comprobación de Python/base desde red interna. No abrir Python, PostgreSQL o métricas administrativas al público para facilitar tests.
- Logs con acceso/retención definidos. El proveedor externo permanece desactivado por defecto hasta acordar operación y condiciones; abrir la web no debe disparar consultas.

`infra/main.tf` aún produce un manifiesto local; no aprovisiona estos recursos. No hay URL o cuenta cloud configuradas por este documento.

El gate de imágenes ahora bloquea cualquier CRITICAL, también sin parche, y HIGH con solución; el informe conserva todos los hallazgos. La prueba del control no reemplaza un escaneo de imágenes actuales ni la revisión de riesgos. Ver [política](seguridad-ep2.md). Se investigaron [opciones de alojamiento](staging-opciones.md), sin contratación ni selección ejecutada.

## Matriz de evidencia disponible y faltante

| Evidencia | Dónde / alcance real |
| --- | --- |
| Fuente real → Python → NestJS → PostgreSQL | [Evaluación acotada](fuente-web-evaluacion.md): corrida `0c301597-c4de-46d7-8e5a-44818bfef04d`, cinco CPU. Persistencia/listado autenticado comprobados; no se atribuye una sesión visual privada a esa prueba. |
| Métrica aplicada | 5 recibidas/válidas, 0 duplicadas, 100% de validez del contrato de esa muestra. Recuperación 1164.098 ms, preparación 4.986 ms, coordinación 1369 ms; antigüedad 148 días, Part Number 0/5. No es cobertura global o benchmark. |
| Contratos, permisos y errores | Suites y pruebas HTTP en `tests/integration/`; red simulada para bordes y fallos. No presentar fixtures como datos recuperados. |
| Cotizador y frontend | 48 pruebas Angular registradas en el tercer corte; edición, cantidades, confirmación y espera. Diseño visual aprobado previamente por el usuario. |
| Backend / Python tras observabilidad | 60 pruebas NestJS y 77 Python, lint/build según [observabilidad](observabilidad-ep2.md). Las cifras de cortes anteriores son históricas. |
| Correlación y salud | Integración QA con Nginx/NestJS/Python, 3 solicitudes correlacionadas, permisos y ausencia de marcas privadas en logs; ambiente local con base saludable. Sin histórico centralizado. |
| Seguridad | [Política y verificación](seguridad-ep2.md): reportes y límites explícitos. Hay hallazgos pendientes; un gate aprobado no significa ausencia de vulnerabilidades. |
| Arquitectura/diseño | [Arquitectura](arquitectura.md), [modelo](modelo-datos-inicial.md), [diseño adaptativo](diseno-adaptativo-ep2.md), [ADR-002](adr/002-referencias-y-adaptacion.md). Ranking y evaluación de utilidad todavía propuestos. |
| Remoto / staging | [CI EP2 #7 aprobado](https://github.com/RodriguezPavezBenjamin/JembaTech/actions/runs/39012531921), SHA `68a0b0d7b91463bfeb9e8057e88166e5fc9c6ab1`, nueve jobs correctos. Faltan URL funcional de staging, salud posterior y coincidencia commit desplegado/tag. |
| Gestión / presentación | Tablero local actualizado. Faltan fecha confirmada y ensayo; no se inventan enlaces o aprobación final. |

## Guion de demo propuesto

Duración orientativa: 8–10 minutos, ajustable a lo que indique la profesora. No se ha ensayado ni grabado por este documento.

1. **Versión y alcance:** abrir staging, indicar commit/release y mostrar límites del piloto de componentes. Si no hay staging, declarar el ensayo como local, no como entrega final.
2. **Usuario:** elegir preset o personalizado, cambiar una pieza y cantidad, mostrar análisis y guardar una cotización QA propia. No modificar clientes reales para la demo.
3. **Administrador/fuente:** abrir Fuentes y calidad desde el avatar. Mostrar categorías, datos propios de cada componente, procedencia, fecha y adquisición de la ficha existente. Una consulta dirigida trae una página de hasta cinco candidatas; usarla solo como acción confirmada cuando las condiciones y operación estén acordadas, nunca repetidamente como efecto visual. Los filtros solo leen PostgreSQL.
4. **Cadena y métrica:** seguir una corrida desde recuperación a preparación y persistencia/listado. Mostrar tamaño de muestra, validez, duplicados y tiempos diferenciados. Explicar por qué la ficha antigua no representa stock ni precios.
5. **Error controlado:** demostrar 401/403 sin acceso a referencias privadas, o una prueba QA de fuente desactivada/fallida. No tumbar servicios ni alterar datos reales; si se muestra un test con transporte simulado, decirlo explícitamente. Conservar la última referencia válida.
6. **DevSecOps/observabilidad:** abrir el run final de Actions, controles y artifacts; mostrar salud y un `X-Request-Id` correlacionado sin credenciales/cuerpos. Explicar límites de métricas por proceso.
7. **Diseño futuro:** explicar alternativas CPU, restricciones antes de preferencias, control del usuario, mapeo revisado y evaluación propuesta. No presentar el puntaje actual como ranking o IA entrenada.
8. **Cierre:** señalar lo pendiente sin declararlo implementado y responder sobre arquitectura/decisiones.

## Comprobaciones antes de publicar

Estos comandos se ejecutan desde la raíz del repositorio y no crean una release ni hacen push:

```powershell
git status --short
git diff --check
node scripts/check-health.mjs
```

La comprobación de salud usa los servicios locales en marcha. En staging deberá ejecutarse desde una red con acceso interno y con destinos configurados, no exponiendo Python para que pase.

Las pruebas de integración que crean cuentas QA y leen logs se ejecutan en un ambiente aislado según la configuración del workflow; no lanzarlas indiscriminadamente contra clientes reales. El test de observabilidad necesita Nginx instrumentado: el servidor de desarrollo Angular no lo sustituye.

Antes de una entrega definitiva, repetir el pipeline sobre el commit elegido, guardar enlaces a sus artifacts/run, comprobar staging y ensayar. Android ya tiene APK debug, prueba unitaria y lint nativo aprobados localmente con JDK 21/SDK trasladado a D:. Portada confirmada en emulador y flujos manuales confirmados por el usuario en web y Android. Incluir las correcciones documentadas en [validación Android](android-validacion.md); siguen pendientes el test instrumentado automatizado y la conexión al futuro staging.
