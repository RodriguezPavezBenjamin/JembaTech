# Commit y validación remota EP2

Actualizado: 2026-10-17. El commit de avance `a2f0cb0` fue publicado por el usuario. **La corrección siguiente aún no tiene commit/push; estos comandos los ejecuta el usuario.** No se crea release ni despliegue.

El conjunto nuevo corrige lectura SARIF, selección de URLs autorizadas, secretos QA/históricos, workflow y pruebas/documentación. Se excluye el cambio local de Gradle/Android. Revisar `git status` y el resumen staged; si aparecen archivos ajenos, detenerse y seleccionar rutas concretas.

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

Registrar el enlace del run y el SHA del commit en el [tablero](tablero-ep2.md). Si falla, compartir nombre de job y log sin claves/credenciales. Un Actions verde del commit nuevo valida el pipeline, **no acredita staging**, porque el despliegue todavía no está configurado.

No crear aún tag/release EP2 ni mover la release EP1. Después de elegir alojamiento y verificar staging se cerrará la versión identificable para entrega.
