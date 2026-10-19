# Commit y validación remota EP2

## Seguimiento del commit 2aa3d17 — 2026-10-18

El usuario publicó catálogo/portada/Android/CI como `2aa3d17`. Secrets bloqueó dos fixtures URI negativas sintéticas; no se declara ese run aprobado. La [corrección de fixtures y triage histórico](ci-secrets-fixtures.md) conserva los controles del scanner y contiene los comandos del siguiente commit. No se hizo commit/push de la corrección por parte del agente.

## Corte anterior a la publicación de 2aa3d17 — 2026-10-18

Ver [validación precommit actual](ci-precommit.md): Actions migradas a Node 24 con SHA completo, Ubuntu 24.04, parches Nginx, checksums Terraform Linux/Windows y pruebas locales repetidas. **Ahora sí se incluye Android**: APK/lint aprobados, portada confirmada en emulador y flujos manuales confirmados por el usuario en web y Android. HEAD sigue en `68a0b0d`; el usuario hará commit/push y comprobará el nuevo run. Railway y release siguen pendientes. Los comandos actuales están en ese documento; las exclusiones de Android que aparecen más abajo son históricas y no se aplican a este corte.

## Preparación local anterior antes de staging — 2026-10-18

Primer paso del cierre: verificar los cambios locales antes de publicarlos. HEAD sigue en `68a0b0d`; esta revisión **no crea un commit, no hace push y no acredita una CI remota nueva**. El cambio de Gradle/Android sigue sin stage y fuera del alcance de esta preparación.

Resultados repetidos sobre el código local actual:

- Backend: ESLint, **139 pruebas en 11 suites** y compilación NestJS aprobados.
- Frontend: ESLint, **68 pruebas en 8 archivos** y compilación Angular aprobados.
- Python: Ruff y **198 pruebas** aprobados en una copia temporal del código, dentro de un contenedor sin red y sin acceso a PostgreSQL. Un aviso de deprecación del TestClient permanece; no es un fallo.
- Controles Node/documento: **27 pruebas** aprobadas. La prueba adicional de imagen PostgreSQL también aprobó con una instancia efímera y almacenamiento temporal, sin utilizar el volumen principal.
- Workflow: `actionlint` aprobado sin ShellCheck/Pyflakes; esto valida estructura/expresiones, no ejecuta Actions ni sus escáneres.
- Salud HTTP del ambiente local activo: frontend, proxy, NestJS, FastAPI y conexión con PostgreSQL correctos. Los contenedores activos no se reconstruyeron ni reiniciaron; esta comprobación no prueba que ejecuten el código recién compilado.
- `git diff --check` sin errores. Git avisa de conversión LF/CRLF, no de un fallo de pruebas.

Los primeros intentos restringidos fallaron por caché temporal de Jest, ejecución nativa de Angular y acceso a localhost/Docker. Se repitieron correctamente con el acceso adecuado. En Python se normalizó el permiso ejecutable únicamente en la copia temporal para evitar el artefacto del montaje Windows; no se desactivaron reglas de Ruff ni se editaron fuentes para silenciarlas. La primera invocación de la prueba de imagen no tenía `TEST_DATABASE_IMAGE`; la repetición con la imagen local identificada aprobó.

Alcance: no se consultó SoloTodo, no se guardaron cotizaciones ni se ejecutaron migraciones. Los tests unitarios usan dobles/fixtures; esta sesión no repite las integraciones completas de importación/precios, CodeQL, Trivy ni auditorías de dependencias. Deben aprobar en el siguiente pipeline del commit publicado. Siguen pendientes los avisos de mantenimiento de Actions del tablero, infraestructura reproducible, despliegue automatizado, verificaciones de staging, condiciones de publicación de la fuente y release EP2.

En ese corte se propuso un commit sin Android; el usuario solicitó después validarlo e incluirlo. Seguir ahora los comandos del corte vigente, no esa exclusión histórica. No reutilizar el run verde anterior para atribuir aprobación a estos cambios.

### Corrección posterior del carrusel

Se revisaron visualmente las 13 fotos originales y se ajustaron títulos, categorías, descripciones y textos alternativos a sus contenidos. Se retiraron testimonios y afirmaciones de reparaciones/rendimiento no respaldadas. La descripción se resuelve por nombre de archivo, no por posición; contador inicial corregido a 13. Compilación Angular aprobada y **31 controles Node/documento** aprobados, incluidos cuatro nuevos que recorren las 13 fichas, navegación/cierre y reordenación, tanto en fuente como en HTML compilado. No implica una CI remota nueva.

### Selección de trabajos publicados en Instagram

Los siete enlaces proporcionados se revisaron en Chrome. La portada muestra tarjetas con fecha, resumen y enlace al original; cinco reutilizan fotos locales coincidentes y dos tienen portadas gráficas identificadas. La galería de 13 fotos queda plegada como respaldo y sin rotación mientras está cerrada. Se probó una vista incrustada, pero quedó en blanco en el ambiente local; se retiró antes de entregar, sin desactivar protecciones del navegador. No se afirma integración API, feed automático ni incrustación funcional.

Versión final: **build Angular aprobado y 35 controles Node/documento aprobados** (15 del documento, incluidos los de la galería anterior). La sección y sus siete enlaces están visibles en la web local; captura de revisión guardada fuera del repositorio. Sin commit/push, despliegue, publicación en Instagram ni cambios en cotizaciones. [Detalle](instagram-portfolio.md).

Ampliación posterior solicitada: panel opaco de «¿Por qué yo?» con verde/azul comprobados en Chrome y ocho publicaciones en carrusel horizontal. Fotos originales recuperadas para Kolink, Ryzen 7 y el nuevo post `DepvUVoGPre`; las ocho tarjetas tienen imagen local. Flechas y teclado verificados visualmente hasta «6–8 / 8». **Build Angular y 39 controles combinados aprobados**, incluidos 19 del documento con navegación, extremos, rango visible, redimensionamiento simulado, movimiento reducido y firma raster de las fotos. Sin comprobación móvil real, CI remota nueva ni cambios en cotizaciones. Capturas finales guardadas fuera del repositorio.

### Sustitución por carrusel 3D automático

Se reemplazó la tira horizontal por una tarjeta central y tarjetas inclinadas en profundidad, con los ocho trabajos originales. Avance circular cada cinco segundos, pausa/reanudación, flechas, teclado y gestos. El controlador suspende los temporizadores por cursor, foco, pestaña oculta y fuera de vista; la navegación manual queda pausada y movimiento reducido evita autoplay inicial/transiciones. Solo la tarjeta central permanece interactiva y expuesta a lectura asistida.

La galería plegada de 13 fotos, su modal, estilos y controlador se eliminaron por petición del usuario. Se conservaron los archivos de imagen compartidos con los presets. Build Angular y **41 controles combinados aprobados**, incluidos 21 del documento sobre fuente y compilado, con reloj/visibilidad/gestos simulados. Se conservan los enlaces HTML sin JavaScript y no se carga una API/feed/widget de Instagram. Sin commit/push, despliegue ni cambios en cotizaciones; no acredita CI remota nueva o prueba móvil real.

## Registro histórico de la CI anterior

Actualizado: 2026-10-17. El usuario publicó el avance `a2f0cb0` y la corrección `68a0b0d7b91463bfeb9e8057e88166e5fc9c6ab1`. **CI EP2 #7 está aprobado**: [run verificado](https://github.com/RodriguezPavezBenjamin/JembaTech/actions/runs/39012531921). No se creó release ni staging. Los comandos siguientes son registro del commit ya realizado, no una instrucción para duplicarlo.

El commit de corrección incluye lectura SARIF, URLs autorizadas, secretos QA/históricos, workflow y pruebas/documentación. El cambio local de Gradle/Android se mantuvo fuera. La actualización documental posterior y el plan de próxima sesión todavía no se han publicado.

Desde PowerShell:

```powershell
Set-Location "S:\Accesos SSD\Desktop\WEB ADVANCED\Primera entrega"
git status --short
git diff --check
git add -- . ':(exclude)frontend/android'
git diff --cached --stat
git commit -m "fix(ci): corrige CodeQL y detección de secretos de prueba"
git push origin main
```

La exclusión evita agregar Android en este paso; no retira archivos que ya estuvieran staged previamente. En la revisión local actual el cambio Gradle está sin stage. No usar `git commit -a`, porque incorporaría modificaciones tracked que se quisieron dejar fuera.

## Qué revisar en GitHub

Abrir el [workflow CI EP2](https://github.com/RodriguezPavezBenjamin/JembaTech/actions), elegir el run del commit recién publicado y verificar todos sus jobs. Los jobs de CodeQL, npm/Python y Trivy pueden bloquear por hallazgos reales: conservar artifacts y corregir la causa, sin excluir controles para obtener verde.

El enlace y SHA aprobados ya están registrados en el [tablero](tablero-ep2.md). Para futuros cambios, verificar su propio run; si falla, compartir nombre de job y log sin credenciales. Un Actions verde valida el pipeline, **no acredita staging**, porque el despliegue todavía no está configurado.

No crear aún tag/release EP2 ni mover la release EP1. Después de elegir alojamiento y verificar staging se cerrará la versión identificable para entrega.
