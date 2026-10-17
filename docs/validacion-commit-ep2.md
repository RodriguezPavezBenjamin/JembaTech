# Commit y validación remota EP2

Preparado: 2026-10-17. **Estos comandos los ejecuta el usuario; no se ha hecho commit, push, release ni despliegue desde esta preparación.**

El conjunto pendiente incluye fuente CPU, seguridad, observabilidad, documentación/diseño, favicon y ajustes previos del frontend. Se excluye el cambio local de Gradle/Android, que no forma parte de este trabajo. Revisar `git status` y el resumen staged antes de confirmar; si aparecen archivos ajenos, detenerse y seleccionar rutas concretas.

Desde PowerShell:

```powershell
Set-Location "S:\Accesos SSD\Desktop\WEB ADVANCED\Primera entrega"
git status --short
git diff --check
git add -- . ':(exclude)frontend/android'
git diff --cached --stat
git commit -m "feat(ep2): integra fuente web, seguridad y observabilidad"
git push origin main
```

La exclusión evita agregar Android en este paso; no retira archivos que ya estuvieran staged previamente. En la revisión local actual el cambio Gradle está sin stage. No usar `git commit -a`, porque incorporaría modificaciones tracked que se quisieron dejar fuera.

## Qué revisar en GitHub

Abrir el [workflow CI EP2](https://github.com/RodriguezPavezBenjamin/JembaTech/actions), elegir el run del commit recién publicado y verificar todos sus jobs. Los jobs de CodeQL, npm/Python y Trivy pueden bloquear por hallazgos reales: conservar artifacts y corregir la causa, sin excluir controles para obtener verde.

Registrar el enlace del run y el SHA del commit en el [tablero](tablero-ep2.md). Si falla, compartir nombre de job y log sin claves/credenciales. Un Actions verde del commit nuevo valida el pipeline, **no acredita staging**, porque el despliegue todavía no está configurado.

No crear aún tag/release EP2 ni mover la release EP1. Después de elegir alojamiento y verificar staging se cerrará la versión identificable para entrega.
