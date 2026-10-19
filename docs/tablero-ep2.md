# Tablero de seguimiento EP2

## Corte vigente, 2026-10-19

- [x] Staging Railway con cuatro servicios; URL https://jembatech.up.railway.app.
- [x] Usuario confirmó Google, ADMIN y coordinación CLIENT → ADMIN → CLIENT.
- [x] CI #13 verde de 1a1279b según captura; repositorio limpio al iniciar este corte.
- [x] Preparación local de workflow posterior a CI, salud de stack y SHA servido,
  módulo Terraform Railway con protección de recursos y control de adopción.
- [x] Secret staging y CD activados; artifact real de `c4dd5dd` con salud completa
  y SHA común de frontend/backend/Python.
- [x] Backup restaurable, estado cifrado y 16 imports Terraform; plan real con
  cero cambios y cero diferencias observadas. [Evidencia](adopcion-railway-evidencia.md).
- [x] Revocación del token temporal Terraform confirmada por el propietario;
  token de CD conservado. Comando de retirada local indicado, sin leer su entorno.
- [ ] Revisar límites IaC de ajustes no modelados por el proveedor comunitario.
- [ ] Publicar cambios locales de adopción/documentación y validar su propia CI/CD.
- [ ] Completar evidencia final de fuente/métrica/error y condiciones de uso.
- [x] Fuentes y calidad en staging: tras el panel inicialmente vacío, el usuario
  cargó la muestra real y confirmó visualmente las cinco fichas, fechas y
  trazabilidad manual. [Evidencia y límites](muestra-staging-ep2.md). No hubo nueva
  consulta a SoloTodo ni se activó el piloto externo.
- [ ] Conservar artifacts, actualizar enlaces/documentación y ensayar demo.
- [ ] Crear tag/release EP2 del commit final validado. No reemplazar EP1.
- [ ] Mejora posterior de recuperación/vinculación de cuentas: pospuesta por usuario.

Detalle vigente: [Railway staging](railway-staging.md). Los cortes siguientes son
históricos; sus pendientes de elegir proveedor o crear staging ya no son actuales.

## Registro histórico

Actualizado: 2026-10-18. Tablero **local Markdown**, aclarado con el usuario; no se creó ni modificó un GitHub Project. Describe avance verificable, no certifica aprobación final de la entrega.

## Hecho y verificado

- [x] Seguimiento del commit publicado `2aa3d17`: secrets detectó dos fixtures URI sintéticas. Datos negativos convertidos a credenciales efímeras; triage histórico por identidad/huella exactas, sin excluir archivos o detectores. Siete pruebas del gate, 22 backend y 27 Python aprobadas; escáner real comprobado en rango e historial completo sobre copia QA. Corrección local aún sin commit/push ni run remoto aprobado. [Causa, pruebas y comandos](ci-secrets-fixtures.md).

- [x] Precommit del 18/10: mantenimiento Actions/SHA y Ubuntu 24.04, parches de dos HIGH en Nginx y checksum Terraform Linux. Frontend 69, backend 139, Python 198, diez pruebas de scripts y 54 controles Node aprobados; builds, auditorías, integraciones Docker aisladas, observabilidad, salud y cinco gates Trivy aprobados. No equivale a nueva CI; commit/push pendiente. [Corte y comandos actuales, incluyendo Android](ci-precommit.md).

- [x] Android: wrapper 8.14.3 con checksum oficial y test instrumentado con identificador propio. Build web/cap sync y controles estáticos aprobados. Tras instalar Android Studio y trasladar SDK/AVD a D: con verificación SHA-256, **APK debug, prueba unitaria y lint nativo aprobados** con JDK 21. Portada confirmada en emulador; **flujos manuales web y Android confirmados por el usuario**. Test instrumentado automatizado y conexión al futuro staging pendientes. [Evidencia y pasos](android-validacion.md).

- [x] Carrusel de trabajos simplificado: tarjetas más anchas, título centrado, Instagram como icono circular, flechas centradas en los lados de la tarjeta y sin marco exterior, párrafos auxiliares, botón de pausa o contador. Autoplay conservado con pausas por cursor/foco y Espacio; movimiento reducido respetado. Build y 45 controles locales aprobados (25 del documento), sin commit/push. [Detalle](instagram-portfolio.md).

- [x] Sección «¿Por qué JembaTech?» reorganizada: título exterior, panel exclusivo para cuatro cifras y tres ventajas independientes alineadas con Servicios. Valores conservados, colores verde/azul y disposición de cifras 2×2 en móvil. Build y 43 controles locales aprobados (23 del documento); sin commit/push.

- [x] Sustitución por carrusel 3D circular de ocho publicaciones: avance automático cada cinco segundos, pausa/reanudación, flechas, teclado y gestos; pausas por lectura/visibilidad y movimiento reducido. Galería plegada y modal anteriores eliminados del código, sin borrar fotos compartidas. Build y 41 controles locales aprobados (21 del documento). Sin commit/push ni nueva CI. [Detalle](instagram-portfolio.md).

- [x] Ajuste de portada: panel «¿Por qué yo?» en verde/azul y carrusel de ocho publicaciones con flechas, teclado, contador y fotos locales 8/8, incluida `DepvUVoGPre`. Build y 39 controles aprobados; sin commit/push ni cambios en cotizaciones. [Detalle](instagram-portfolio.md).

- [x] Portada: siete trabajos vinculados a publicaciones originales de Instagram, fechas y resúmenes contrastados en Chrome; galería anterior plegada, sin borrar imágenes compartidas. Build y 35 controles Node/documento aprobados. La vista incrustada quedó en blanco en local y se retiró; su verificación en staging sigue pendiente y no bloquea el acceso por enlaces. [Alcance](instagram-portfolio.md).

- [x] Carrusel: 13 fotos revisadas, descripciones y textos alternativos coherentes, sin testimonios/datos de rendimiento no respaldados. Asociación por archivo y contador corregido. Build y 31 controles Node/documento aprobados; publicación/CI nueva pendientes.

- [x] Primer paso previo a staging (18/10): revisión local, lint/build web, 139 pruebas NestJS, 68 Angular, 198 Python, 27 controles Node y prueba efímera PostgreSQL aprobados. Workflow validado con actionlint y ambiente activo saludable; sin commit/push, consultas externas, migraciones ni cambios en cotizaciones. No equivale a nueva CI o despliegue. [Detalle y límites](validacion-commit-ep2.md).

- [x] Ampliación visible local de 22 componentes (8 CPU, 4 GPU, 2 placas, 4 RAM y 4 discos), sin modificar cotizaciones previas. Uso previsto explicado sin prometer segmentación/recomendaciones automáticas. Nuevos precios estimados explícitos, fotos/procedencia y validación en [catálogo ampliado](catalogo-ampliado.md); CI remota pendiente.

- [x] Cotizador y gestión de cotizaciones: flujo, cantidades, edición, consultas y vistas administrativas.
- [x] Recuperación CPU real bajo demanda → FastAPI → NestJS → PostgreSQL → listado privado para Angular.
- [x] Normalización, deduplicación, identidad/hash/fechas, permisos de acceso y auditoría; conservación ante fallos.
- [x] Evaluación acotada de cinco CPU reales, fórmulas/resultados y límites documentados en [fuente web](fuente-web-evaluacion.md). No se declara muestra representativa.
- [x] Primera ampliación CPU/GPU local: búsquedas dirigidas, panel/filtros, corrección de núcleos híbridos y VRAM; muestras reales de cinco CPU y cinco GPU guardadas/listadas. [Evidencia y límites](fuente-web-componentes.md). Cotizador sin enriquecimiento externo todavía; nueva CI pendiente.
- [x] Segunda ampliación local: contratos y panel para placas, RAM DDR4/DDR5 y HDD/SSD; slots/puertos, módulos/kits, unidades e interfaces. Cinco adquisiciones puntuales guardaron/listaron 25 candidatas (B650, DDR5, HDD, SATA y PCIe M.2). Validación independiente de pertinencia; no se infiere NVMe desde M.2. [Evidencia y límites](fuente-web-componentes.md).
- [x] Precios consultados locales: adaptador de ofertas CLP y ocho correspondencias revisadas; precio normal, tienda, fechas, caducidad de 24 h y estimación de respaldo explícita. Dos modelos adicionales en el cotizador y ocho búsquedas técnicas adicionales (23). Auditoría y conservación de cotizaciones. [Corte, pruebas y recuperaciones](precios-cotizador.md). Nueva CI y despliegue siguen pendientes.
- [x] Revisión y registro de condiciones del proveedor; operación sin cron, sin imágenes/datos personales y con espera. **No equivale a obtener permiso de republicación.**
- [x] Diseño adaptativo preliminar, arquitectura/modelo/diagramas y ADR actualizados.
- [x] Seguridad y observabilidad inicial implementadas, con hallazgos/límites explícitos. Bloqueo de imágenes incluye CRITICAL sin parche.
- [x] **CI EP2 #7 aprobado** para commit `68a0b0d7b91463bfeb9e8057e88166e5fc9c6ab1`: frontend, backend, Python, auditoría Python, ambos CodeQL, secretos, Terraform y Docker. [Run verificado](https://github.com/RodriguezPavezBenjamin/JembaTech/actions/runs/39012531921).
- [x] Tablero local y guion de demostración preparados.

## Hecho local: catálogo útil desde SoloTodo

Nueva ampliación del armador: [catálogo SoloTodo con foto y oferta validada](catalogo-solotodo.md). Importador de cinco categorías implementado, probado y cargado: **62 modelos** (25 CPU, 12 GPU, 7 RAM, 13 placas y 5 gabinetes). Fotos 62/62 comprobadas, revisión parcial para datos de montaje ausentes y restauración tras reinicio verificada. Cotizaciones existentes intactas. Los 120 productos son un tope, no una cantidad completada ni cobertura total. Staging, release, derechos y CI remota nueva siguen pendientes.

El [circuito de referencias técnicas](fuente-web-componentes.md) continúa separado del nuevo importador del armador. El vínculo local de este último sí está implementado; no activa sincronización recurrente ni acredita derechos de publicación. Falta publicar y validar estos cambios en Actions.

1. **Modelos seleccionados/de uso común:** implementada búsqueda dirigida CPU AMD/Intel y GPU AMD/NVIDIA, con referencias del cotizador y comparación reciente. No equivale a cobertura completa o SKU aprobado; se conserva evidencia histórica.
2. **Categorías principales:** CPU/GPU, placas madre, RAM DDR4/DDR5 y almacenamiento HDD/SSD implementados en circuito privado, con preparador, contrato, métricas y pruebas por categoría. Selecciones SATA/PCIe M.2 disponibles; protocolo NVMe no confirmado cuando falta en origen. Cobertura acotada, no catálogo completo.
3. **Vincular con el cotizador:** importador local de cinco categorías con ID externo, foto identificada, oferta apta y validación independiente en Nest. Conserva los ocho mapeos anteriores y snapshots históricos. Cobertura acotada, campos faltantes por confirmar y derechos pendientes; no producto vendible certificado ni sobrescritura por similitud de nombre.
4. **Mostrar vigencia real:** implementados fechas separadas, campos faltantes y aviso interno de revisión después de 90 días. Un 100% válido no es exactitud comprobada ni actualidad del catálogo.
5. **Actualización controlada:** primero flujo útil bajo demanda, caché y conservación ante fallos; programación recurrente solo con condiciones/límites de uso acordados. Nunca prometer estar siempre actualizado ni consultar al proveedor por abrir una página.
6. **Precios/stock:** implementada consulta confirmada de una página de ofertas para ocho modelos; CLP, nuevo, disponibilidad declarada, fecha, normal/oferta y vencimiento. Sin oferta apta vuelve a ESTIMADO; no tratar nulo como cero ni afirmar mínimo global/stock garantizado. Acceso técnico público no resuelve condiciones de republicación o recurrencia.
7. **Resto del armado:** gabinetes incluidos en la nueva importación. Fuentes, refrigeración, almacenamiento y accesorios conservan su alcance anterior y sus estimaciones cuando corresponde; no se presentan como extraídos por esta ampliación.

Criterio de cierre del enriquecimiento: una muestra útil y acotada, contrato/pruebas por categoría, vínculo revisado y un dato externo autorizado efectivamente visible en el cotizador; sin modificar snapshots de cotizaciones existentes. El circuito privado y sus pruebas no completan por sí solos ese cierre.

## Mantenimiento de avisos de Actions (2026-10-18)

- [x] Checkout 7.0.1, setup-node 7.1.0, setup-python 7.0.0 y upload-artifact 7.0.2: runtime Node 24 confirmado en los metadatos oficiales; referencias fijadas a SHA completo. Cambios revisados: ESM, credenciales checkout, token npm y compatibilidad del runner. No se usan disparadores privilegiados de forks, registry-url, pip-install ni autenticación Git desde contenedores. Se conserva Node 22 de la app y Python 3.12.
- [x] Ocho jobs fijados en `ubuntu-24.04` para evitar la migración automática de `ubuntu-latest` durante el cierre de EP2.
- [x] Workflow aprobado con actionlint 1.7.7 (sin ShellCheck/Pyflakes) y cinco controles estáticos de política integrados en frontend. Gates de seguridad y artifacts conservados.
- [ ] Publicar el nuevo commit y ejecutar su propio Actions; comprobar que desaparecen los avisos correspondientes y se mantienen los controles/pruebas aprobados.

El usuario publicó esos cambios en `2aa3d17`; el nuevo run reportó el bloqueo de las dos fixtures URI del apartado anterior. La corrección posterior sigue local. El run #7 sigue siendo evidencia exclusiva de `68a0b0d`, no una aprobación de 2aa3d17 ni de esta corrección.

## Validación y cierre que aún faltan

- [x] Publicar corrección y repetir CI: `68a0b0d`, [run #7](https://github.com/RodriguezPavezBenjamin/JembaTech/actions/runs/39012531921), todos los jobs aprobados. El run #6 fallido se conserva como evidencia de corrección.
- [ ] Conservar/revisar artifacts y riesgos no bloqueantes. Un gate aprobado no significa ausencia de vulnerabilidades; su retención remota es limitada.
- [ ] Ensayar la demo sobre la versión final y confirmar fecha/modalidad con la profesora.

## Pendiente por decisión externa

- [ ] **Staging:** elegir alojamiento autorizado, configurar Terraform/Secrets, despliegue desde Actions, salud y URL. [Opciones investigadas](staging-opciones.md), sin cuentas ni recursos creados.
- [ ] **Release EP2:** mantener pendiente hasta tener commit validado y versión desplegada identificable; no mover ni reemplazar la release EP1.
- [ ] **Derechos de la fuente:** confirmar reutilización/republicación antes de uso recurrente o enriquecimiento público. El análisis está hecho; la respuesta del proveedor no existe y no se marca aprobada.

## Fuera de cierre técnico del piloto / evolución posterior

- [ ] Ampliar representatividad y contraste independiente después de la muestra útil acotada descrita arriba; no confundir cobertura pequeña con catálogo completo.
- [ ] Implementar y evaluar el motor adaptativo especificado; no es necesario terminarlo para el diseño preliminar EP2.

La cobertura limitada se debe exponer en la defensa y puede afectar el nivel de la rúbrica; documentarla no elimina esa limitación. Detalle: [cierre y demo](cierre-ep2.md) y [semáforo](entrega-2.md).
