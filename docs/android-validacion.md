# Validación Android — 18/10/2026

El usuario pidió validar Android e incluir sus correcciones, no excluirlo sin revisión. No se hizo commit/push. El usuario instaló Android Studio y preparó el SDK; el agente no aceptó licencias por él.

## Diagnóstico inicial y preparación

- Capacitor Android/Core/CLI instalados: 8.5.3. Plugin Android (AGP): 8.13.0; API objetivo/compilación: 36; Java de compilación: 21.
- Se ejecutó el wrapper anterior con Gradle 9.7.1 y Java 25.0.1. La configuración falló: AGP usa InternalProblems, API interna eliminada en Gradle 9.6. No fue una compilación aprobada.
- Wrapper corregido a Gradle 8.14.3, combinación documentada para Capacitor 8. Se fijó distributionSha256Sum con el valor recuperado de la URL oficial.
- Se repitió assembleDebug/testDebugUnitTest/lintDebug con el Java disponible inicialmente (25). Falló con Unsupported class file major version 69. Después, el usuario instaló Android Studio 2026.2.1 y JBR 21.0.11; el wrapper 8.14.3 ya inicia correctamente con ese JDK.
- El primer intento de iniciar el emulador desde Android Studio falló por espacio insuficiente en C:, no por un error de la aplicación.
- npm.cmd run android:prepare aprobó: compilación Angular y cap sync android completados. El índice web copiado coincide por SHA-256 con el compilado. Esto solo valida la preparación de recursos.
- Se corrigió el test instrumentado que todavía esperaba com.getcapacitor.app; ahora espera cl.jembatech.cotizador. Ese test no se presenta como ejecutado.

## Traslado local a HDD completado — 18/10/2026

- SDK: `D:\Android\Sdk`; dispositivos virtuales: `D:\Android\avd`. Se conservaron el proyecto y la instalación de Android Studio en sus ubicaciones originales.
- Copias comprobadas por ruta, tamaño y SHA-256: 39.926 archivos del SDK y 8 del AVD, sin diferencias. Solo después de verificar y probar las herramientas se retiraron las dos copias antiguas de C:.
- `ANDROID_HOME` y `ANDROID_AVD_HOME` del usuario, `local.properties`, el índice AVD y las rutas SDK de Android Studio apuntan a D:. Las rutas antiguas de C: son enlaces de compatibilidad, no otras copias físicas.
- Respaldos de configuración, variables anteriores, manifiestos y registros: `D:\Android\migration-backup-20261018`. Los datos completos siguen en D:; no se borraron el proyecto, documentos ni otros datos de Android.
- C: quedó con aproximadamente 8,97 GiB libres al terminar (valor variable). El AVD tiene una partición de datos configurada de 10 GB, ahora alojada en D:.
- `adb version` y `emulator -list-avds` correctos desde D:; se reconoce `Medium_Phone_API_37.0`. `emulator -accel-check`: WHPX instalado y utilizable. Estos controles no acreditan todavía el arranque del dispositivo ni los flujos de la app.
- Se ignora `.idea/` para no versionar ajustes locales del IDE. Se conservaron los archivos locales existentes.

## Compilación nativa aprobada después del traslado

Con JBR 21.0.11 y SDK en D: se ejecutaron `:app:assembleDebug :app:testDebugUnitTest :app:lintDebug --rerun-tasks --no-daemon --console=plain`: **BUILD SUCCESSFUL**, 128 tareas ejecutadas.

- APK debug generada: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`. Archivo local ignorado por Git; no es una release firmada para publicación.
- Una prueba unitaria de ejemplo aprobada (suma); no demuestra los flujos de negocio.
- Lint nativo aprobado, sin errores y con 15 advertencias no bloqueantes de recursos, manifiesto y actualización de dependencias. También hay avisos de repositorios `flatDir` de la plantilla Capacitor. No se desactivaron controles ni se creó una baseline para ocultar errores.
- El primer lint tras el traslado señaló el separador de unidad sin escapar en `local.properties`. Se corrigió a `sdk.dir=D\:/Android/Sdk` y se repitieron las tareas sin caché porque el análisis anterior persistía.
- Arranque posterior confirmado visualmente con captura del usuario: la APK supera la pantalla de Capacitor y muestra la portada JembaTech en el emulador.
- El usuario confirmó haber probado catálogo/armador, cuenta y cotizaciones tanto en web como dentro de Android. Se registra como **prueba manual reportada por el usuario**, no como suite automatizada ejecutada por el agente. No hace falta repetirla por falta de registro.
- Pendientes: test instrumentado automatizado y validación contra el futuro staging. Railway todavía no tiene despliegue configurado.

## Preparar otro entorno

1. Instalar [Android Studio oficial](https://developer.android.com/studio), compatible con Capacitor 8 (2025.2.1 o posterior).
2. En SDK Manager, instalar Android SDK Platform 36, SDK Build-Tools 35.0.0 y Platform-Tools. Emulador/imagen del sistema si se utilizará un dispositivo virtual. Leer y aceptar personalmente las licencias que presente el instalador.
3. En la configuración Gradle de Android Studio, seleccionar JDK 21 y usar el wrapper del proyecto. No actualizar Gradle a otra versión mayor para hacer desaparecer un aviso. Android Studio puede ofrecer descargar el JDK; verificar qué versión quedó seleccionada.
4. Indicar la ruta del SDK mediante ANDROID_HOME o local.properties. Esta última es local y está ignorada; no subir rutas personales o credenciales.

En PowerShell, reemplazar las dos rutas con las reales; estas variables solo afectan esa terminal:

```powershell
Set-Location "S:\Accesos SSD\Desktop\WEB ADVANCED\Primera entrega\frontend"
$env:JAVA_HOME = "C:\Users\Jemba\.jdks\jbr-21.0.11"
$env:ANDROID_HOME = "D:\Android\Sdk"
$env:ANDROID_AVD_HOME = "D:\Android\avd"
& "$env:JAVA_HOME\bin\java.exe" -version
npm.cmd run android:prepare
Set-Location android
.\gradlew.bat :app:assembleDebug :app:testDebugUnitTest :app:lintDebug --no-daemon --console=plain
```

Solo BUILD SUCCESSFUL valida esas tareas. La APK debug aparecerá en frontend/android/app/build/outputs/apk/debug/app-debug.apk; no se publica en Git. No está firmada para distribución comercial.

Con un emulador preparado, ejecutar también las pruebas instrumentadas con :app:connectedDebugAndroidTest y revisar arranque, navegación, adaptación, imágenes y ausencia de errores. Un test de suma o del identificador de paquete no valida el flujo de negocio.

## Configuración móvil y alcance de las pruebas

Las llamadas Angular usan /api relativo y Capacitor sirve recursos locales con esquema HTTPS. La confirmación manual del usuario se conserva, pero no se inspeccionó durante esa prueba qué endpoint ni qué entorno atendió cada solicitud. Todavía no hay un destino HTTPS de staging configurado para la APK. Al desplegar, configurar y comprobar el backend móvil y repetir la validación contra esa URL, sin confundir el entorno local con el público. No abrir PostgreSQL/FastAPI al público como solución.

## Controles y alcance del commit

tests/integration/android-config.test.mjs comprueba estáticamente wrapper/checksum, versiones declaradas, identificador y exclusión de archivos generados. Está incorporado al job frontend con nombre explícito: no genera APK ni sustituye un SDK.

Resultado local: tres controles Android y 26 del documento aprobados (29 en conjunto); diff sin errores. No se atribuye aprobación a una nueva ejecución remota de Actions.

Las correcciones Android sí pueden incluirse en el commit con frontend/android y estos tests/documentos. Compilación nativa, prueba unitaria y lint locales aprobados; portada confirmada en emulador y flujos manuales reportados por el usuario en ambos entornos. Siguen pendientes el test instrumentado automatizado y las verificaciones del futuro staging.

Fuentes: [guía Capacitor 8](https://capacitorjs.com/docs/updating/8-0), [compatibilidad AGP 8.13](https://developer.android.com/build/releases/agp-8-13-0-release-notes), [checksum oficial Gradle 8.14.3 all](https://services.gradle.org/distributions/gradle-8.14.3-all.zip.sha256).
