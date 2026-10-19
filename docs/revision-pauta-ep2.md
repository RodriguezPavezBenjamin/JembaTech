# Revisión de cierre contra la pauta EP2

Fecha: 2026-10-19. Fuente: `../ProyectoFinal .pdf` desde la raíz del repositorio,
pp. 17–18 y 35–40. Se revisaron las páginas completas pertinentes y la página 39
también renderizada. No certifica una nota ni sustituye la revisión docente.

## Evidencia y pendientes concretos

| Bloque de la pauta | Evidencia disponible | Qué falta para el cierre |
| --- | --- | --- |
| Fuente, preparación y persistencia (pp. 35–37) | [Corrida real y métricas](fuente-web-evaluacion.md), [ampliación](fuente-web-componentes.md), contratos/pruebas y [cinco referencias reales visualizadas en staging](muestra-staging-ep2.md). | Distinguir la adquisición API local de la carga manual de esos datos en Railway; no presentar la muestra como adquisición nueva. |
| Métrica aplicada (p. 37) | Muestra identificada: 5 recibidas, 5 válidas, 0 duplicadas; validez del contrato 100%, recuperación 1164.098 ms. | Presentar justificación y límites: no es exactitud de especificaciones, cobertura total ni catálogo vigente. No es necesario repetir la extracción para mejorar las cifras. |
| Diseño preliminar adaptativo (p. 38) | [Especificación](diseno-adaptativo-ep2.md), usuario, contexto, datos, decisión, salida y evaluación propuesta. | Presentarlo como diseño. Motor completo, A/B y evaluación final con usuarios no se exigen todavía (p. 40). |
| Pipeline, staging y salud (pp. 18, 38–39) | CD real del SHA `c4dd5dd`, artifact con salud completa; comprobación pública de portada, versión y salud repetida durante este cierre. | Publicar los cambios locales y aprobar su propia CI/CD; conservar enlaces/artifacts de ese SHA final. Pages no reemplaza el stack Railway. |
| IaC reproducible (pp. 17–18) | [Adopción real de 16 objetos](adopcion-railway-evidencia.md), cero cambios/diferencias, EFS y recuperación; módulo validado con mocks. [Complemento nativo](../infra/railway-native/README.md) declara healthchecks, pre-deploy y puerto, bloquea apply y obtuvo un plan real sin cambios. Pruebas/CI del complemento preparadas para el próximo commit. | No confundir declaración contrastada con reconstrucción integral. Terraform conserva su alcance; no se habilitó un segundo escritor ni se recrean automáticamente los ajustes complementarios. La política de autodeploy desactivado se verifica por separado. No reactivar tokens ni aplicar para ocultar la brecha. |
| Observabilidad y error (pp. 38–39) | [Correlación, métricas y pruebas de errores](observabilidad-ep2.md); CI prueba indisponibilidad en QA aislado y fuente simulada. | Mostrar evidencia de un error controlado en ambiente aislado; no tumbar staging ni consultar deliberadamente una fuente para provocar errores. No afirmar histórico centralizado. |
| Documentación y formato común (pp. 39–40) | README, API Swagger/OpenAPI, arquitectura, despliegue, [tablero local](tablero-ep2.md), prototipo enlazado y [guion](cierre-ep2.md). | Commit final validado, tag/release evaluable, enlaces, participación de integrantes y ensayo. No inventar fecha, participación, grabación o aprobación. |

## Paso visual seguro

1. Entrar en https://jembatech.up.railway.app con una cuenta que ya sea ADMIN.
2. Abrir el menú de la cuenta → **Fuentes y calidad**, o navegar a
   https://jembatech.up.railway.app/admin/fuentes.
3. Revisar registros, procedencia/fechas y corridas/métricas ya persistidas.
   Cambiar filtros solo consulta la base; no pulsar Recuperar ni Importar.
4. Si está vacío o redirige, registrar lo observado y revisar antes de actuar.
   No cambiar roles, crear cuentas ni activar el flag externo automáticamente.

Estado de este paso: el usuario abrió el panel y aportó una captura: **0
referencias, 0 ejecuciones, sin datos del último lote ni ejecuciones registradas**.
La pantalla indica consulta desactivada por configuración del servidor y no
muestra un error de carga. Esto confirma acceso visual al panel, no una demo de
datos en staging. No se trasladaron automáticamente las corridas locales.
Las métricas históricas permanecen evidencia de su corrida original, no de una
nueva adquisición pública.

El propietario autorizó trasladar cinco registros reales mediante muestra JSON.
Se recuperaron de la corrida local y se [validó la reconstrucción](muestra-staging-ep2.md):
cinco huellas y fechas originales coincidentes, sin red externa ni escrituras.
El propietario cargó el archivo por su sesión ADMIN y aportó capturas de las cinco
fichas, con fechas/procedencia y huella original visible en 8914. El sistema lo
identifica como muestra declarada (`manual-sample`), no como adquisición API nueva;
no modifica catálogo ni cotizaciones. No se usaron fixtures sintéticas. No se
atribuyen a Railway las métricas offline ni se considera adquirida allí la muestra.

## Condiciones de operación

La revisión de restricciones de fuente sí está documentada; una autorización de
republicación no se inventa. Mantener `SOLOTODO_MANUAL_PROBE_ENABLED=false` en
Railway. La demostración de información real debe conservar procedencia y límites;
si hace falta una adquisición nueva, acordar primero alcance y condiciones.

El token temporal de Terraform fue revocado según confirmación del propietario;
se conserva el de CD. No se hizo commit, push, tag ni release en esta revisión.
