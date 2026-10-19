# Ficha de entrega EP2 — JembaTech

Preparada el **19 de octubre de 2026**. Modalidad: **grupal, dos integrantes**.
Reúne enlaces, participación y evidencia del avance. La entrega final queda
condicionada a publicar esta documentación, validar ese commit, ensayar y crear el tag/release.
No se ha informado una fecha límite ni un formato institucional obligatorio.

## 1. Proyecto e integrantes

**JembaTech** permite cotizar computadores, revisar reglas de compatibilidad,
capacidades, consumo y presupuesto, y coordinar solicitudes cliente/administrador.
El puntaje es orientativo: no predice FPS ni certifica el armado.

| Integrante | Aporte declarado por el equipo |
| --- | --- |
| Benjamín Rodríguez Pavez | Desarrollo e integración del proyecto: cotizador e interfaz Ionic/Angular; autenticación, roles y flujo cliente/administrador; coordinación NestJS–FastAPI y persistencia PostgreSQL; integración de fuentes, validaciones y métricas; pruebas, seguridad, pipeline CI/CD y despliegue Railway; adopción Terraform, respaldo/recuperación y complemento de infraestructura; documentación y preparación de la entrega.|
| Álvaro Del Pino | Corrección de errores del pipeline de CI y verificación de las conexiones de las APIs y de la integración de los productos. |

## 2. Enlaces de revisión

| Elemento | Enlace / identificación |
| --- | --- |
| Repositorio | [JembaTech](https://github.com/RodriguezPavezBenjamin/JembaTech) |
| Aplicación staging | [Web en Railway](https://jembatech.up.railway.app) |
| Versión del frontend | [version.json](https://jembatech.up.railway.app/version.json) |
| Salud de backend, Python y base | [/api/health](https://jembatech.up.railway.app/api/health) |
| Contrato del backend | [Swagger](https://jembatech.up.railway.app/api/docs) / [OpenAPI JSON](https://jembatech.up.railway.app/api/docs-json) |
| Referencias técnicas | [Fuentes y calidad](https://jembatech.up.railway.app/admin/fuentes), requiere sesión ADMIN |
| Arquitectura y datos | [Arquitectura](arquitectura.md) / [modelo](modelo-datos-inicial.md) |
| Seguimiento | [Tablero Markdown versionado](tablero-ep2.md), no un GitHub Project remoto |
| Adaptación preliminar | [Diseño propuesto](diseno-adaptativo-ep2.md) |
| Prototipo existente | [Figma EP1](https://www.figma.com/design/kZ1zM9aB2wOM6i9Gmc5U9f/JembaTech---Mockups-EP1?node-id=0-1), no se afirma un prototipo EP2 nuevo |
| Despliegue y rollback | [Railway staging](railway-staging.md) |
| Infraestructura | [Terraform](../infra/railway/README.md) / [Railway IaC de solo lectura](../infra/railway-native/README.md) |
| Presentación | [Guion y checklist](cierre-ep2.md); ensayo pendiente |

Las rutas administrativas requieren autorización; no se entregan credenciales
en esta ficha. GitHub Pages no sustituye el stack completo de Railway.

## 3. Identidad de versión y pipeline

### Corte anterior con despliegue y salud comprobados

- SHA: [`5ef1e0716d2223d974cfdd00b8bbd2d86c834907`](https://github.com/RodriguezPavezBenjamin/JembaTech/commit/5ef1e0716d2223d974cfdd00b8bbd2d86c834907).
- [CI EP2 #17](https://github.com/RodriguezPavezBenjamin/JembaTech/actions/runs/39212559189): **success**.
- [Railway staging #4](https://github.com/RodriguezPavezBenjamin/JembaTech/actions/runs/39212869081): **success**.
- Lectura HTTPS posterior: portada y versión correctas; frontend/backend/Python
  con ese mismo SHA y PostgreSQL saludable. No sustituye una nueva revisión del
  flujo de negocio en cada versión futura.
- [Resumen sanitizado conservado](evidencias/staging-5ef1e07.json) del artifact
  `staging-evidence` de Railway staging #4: resultado, SHA, servicios y salud;
  omite IDs de despliegue y no contiene secretos. No es el ZIP original.
  La retención del artifact original indicada por GitHub termina el
  **2 de noviembre de 2026**; conservarlo aparte si la entrega requiere el ZIP.

### Candidato técnico posterior validado

- SHA: [`fd8d437293682e6c2dcbd0592f89728073c45dd1`](https://github.com/RodriguezPavezBenjamin/JembaTech/commit/fd8d437293682e6c2dcbd0592f89728073c45dd1).
- Incluye el complemento Railway IaC, sus pruebas y documentación.
- [CI EP2 #18](https://github.com/RodriguezPavezBenjamin/JembaTech/actions/runs/39214365822): **success**.
- [Railway staging #5](https://github.com/RodriguezPavezBenjamin/JembaTech/actions/runs/39214746040): **success**.
- Consulta HTTPS posterior: frontend/backend/Python sirven este mismo SHA y
  PostgreSQL está saludable.
- [Resumen conservado de staging #5](evidencias/staging-fd8d437.json), obtenido de
  su artifact sanitizado, sin IDs de despliegue ni secretos. No es el ZIP original;
  este tiene retención indicada hasta el **2 de noviembre de 2026**.
- Tag/release EP2: **pendiente**, del commit final que apruebe CI/CD; conservar EP1.

Estos enlaces identifican evidencia concreta, no el estado permanente de `main`.
Los resultados de `5ef1e07` no aprueban automáticamente `fd8d437` ni el commit
posterior que incorpore esta ficha. Al cerrar la release, su tag será la referencia
final; no es necesario insertar aquí el SHA del propio commit de esta ficha.

## 4. Evidencias y alcance demostrado

| Bloque | Evidencia y resultado | Límite importante |
| --- | --- | --- |
| Aplicación y coordinación | Ionic/Angular → NestJS → FastAPI → PostgreSQL. Google y solicitud CLIENT → respuesta ADMIN → seguimiento CLIENT confirmados por el propietario. | Confirmación funcional previa; no una nueva prueba automatizada del navegador por cada SHA. |
| Fuente y preparación | [Adquisición real del 17/10](fuente-web-evaluacion.md): cinco CPU, procedencia, hash, fechas, normalización, deduplicación y persistencia. | Adquisición API local, muestra pequeña y antigua AMD/FM2; no catálogo comercial completo. |
| Datos en staging | [Cinco referencias reales](muestra-staging-ep2.md), trasladadas por la sesión ADMIN como muestra declarada; listado y trazabilidad confirmados mediante capturas del propietario. | No extracción API nueva en Railway. Las métricas offline no se atribuyen a esa carga. |
| Métrica aplicada | Lote original: 5 recibidas, 5 aceptadas, 0 rechazadas/duplicadas; 100% de validez del contrato. Recuperación 1164.098 ms; preparación Python 4.986 ms; coordinación 1369 ms. | No exactitud factual del 100% ni cobertura global. Part Number 0/5; antigüedad de origen de 148 días al adquirir la muestra. |
| Error controlado | Suite local `backend/src/sources/sources.spec.ts`: **27/27** aprobadas, incluidos Python indisponible y conservación de referencias. [Observabilidad](observabilidad-ep2.md) describe además QA y correlación. | HTTP/Prisma simulados en la suite unitaria; no se dañó staging ni se apagó su Python para demostrarla. |
| Automatización y seguridad | CI/CD del corte aprobado enlazados arriba; controles de dependencias, CodeQL, secretos, imágenes y salud/versiones. [Política](seguridad-ep2.md). | Un gate aprobado no demuestra ausencia absoluta de vulnerabilidades ni sustituye la revisión de reportes. |
| Terraform | [16 objetos adoptados](adopcion-railway-evidencia.md), plan real cero cambios/cero diferencias, estado EFS privado y token temporal revocado según confirmación del propietario. | Sin apply; no acredita reconstrucción integral desde cero. |
| Complemento de infraestructura | [Declaración nativa](../infra/railway-native/README.md): healthchecks, pre-deploy y puerto explícitos; once pruebas propias y plan real cero cambios/escrituras. Suite local conjunta: **111/111**; CI EP2 #18 y CD #5 del candidato aprobados. | Solo lectura, apply bloqueado, sin segundo gestor activo ni transferencia de propiedad ni reconstrucción integral desde cero. |
| Respaldo y recuperación | Respaldo PostgreSQL restaurado en una base temporal aislada; copia EFS y recuperación protegida en disco externo confirmadas. | No se publican el respaldo ni el certificado. No se afirma que todas las copias históricas estén cifradas. |
| Adaptación futura | [Diseño preliminar](diseno-adaptativo-ep2.md): contexto, restricciones, decisión, motivos visibles y evaluación propuesta. | Ranking completo, aprendizaje, A/B y evaluación final con usuarios no implementados. |

No repetir adquisiciones, imports o cargas para presentar esta evidencia. La
consulta externa permanece desactivada en Railway; la reutilización/republicación
no se presenta como autorizada por el proveedor.

## 5. Antes de entregar

- [x] Nombres de los dos integrantes y aportes declarados completos.
- [x] Enlaces y evidencia reunidos con sus límites.
- [ ] Confirmar CI/CD y SHA saludable del commit final; conservar su artifact
  sanitizado y asociarlo al tag/release.
- [ ] Ensayar cliente/admin, fuentes, métrica, error QA y pipeline.
- [ ] Confirmar fecha, plataforma y formato que solicite la docente.
- [ ] Crear tag/release EP2 sin reemplazar EP1 y comprobar los enlaces entregados.

No adjuntar `.env`, JWT, contraseñas, tokens, estado/planes Terraform, respaldos
PostgreSQL, PFX ni registros privados de clientes. La mejora de vinculación y
recuperación de cuentas queda pospuesta por decisión del equipo.
