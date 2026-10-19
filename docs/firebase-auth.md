# Acceso con Google mediante Firebase Authentication

## Alcance y estado

Integración **web** opcional, adicional al acceso local existente por correo y
contraseña. Firebase comprueba la identidad Google; NestJS verifica su ID token y
PostgreSQL conserva el UUID de negocio, el rol CLIENT/ADMIN y las cotizaciones.
No se trasladan cotizaciones a Firestore ni se eliminan cuentas con la migración.

El usuario preparó Firebase: proyecto `jembatech`, app JembaTech Web, Google
habilitado, dominio `jembatech.up.railway.app` autorizado y plan Spark. El 2026-10-19
el usuario confirmó el acceso Google en Railway, la asignación explícita de ADMIN
a su cuenta de prueba y el recorrido CLIENT → solicitud → revisión/respuesta ADMIN
→ seguimiento CLIENT. La captura del cliente muestra EN REVISIÓN y la respuesta.
Esta evidencia manual no sustituye las pruebas del APK ni de recuperación de acceso.

**No se migran las contraseñas locales a Firebase ni se añade recuperación local
de contraseña**. El acceso previo se conserva. Para cuentas Google, la recuperación
se gestiona en Google. Migrar también correo/contraseña y recuperación a Firebase
es un paso separado; no se presenta aquí como terminado.

El APK conserva el acceso local. Google no se abre mediante un popup WebView:
faltan el SDK nativo, configuración Android/SHA-1 y prueba en dispositivo.

## Variables en Railway

Agregar **solo al servicio backend**, entorno staging:

```dotenv
FIREBASE_AUTH_ENABLED=true
FIREBASE_PROJECT_ID=jembatech
FIREBASE_WEB_API_KEY=valor_apiKey_del_firebaseConfig
FIREBASE_WEB_APP_ID=valor_appId_del_firebaseConfig
```

Copiar `apiKey` y `appId` directamente de la configuración web, sin comillas de
JavaScript. No se necesitan `storageBucket` ni `messagingSenderId`. No modificar
JWT_SECRET, DATABASE_URL, migraciones, puertos ni redes existentes. No se pide
JSON de cuenta de servicio, clave privada, tarjeta ni activar Blaze/SMS.

La verificación usa proyecto explícito y certificados públicos del SDK Admin;
no hace operaciones administrativas Firebase que necesiten credenciales privadas.
No configurar FIREBASE_AUTH_EMULATOR_HOST: se rechaza con Google habilitado para
no aceptar tokens de emulador en el sitio público.

El frontend lee solo cuatro campos públicos desde `GET /api/auth/google/config`;
no expone las otras variables. El SDK se carga diferido. Sin habilitación, el
acceso local sigue funcionando. Los valores web no conceden roles ni acceso a datos;
no se guardan aquí para no confundirlos con secretos ni disparar el escaneo.

Publicar y comprobar CI antes de desplegar. La migración agrega firebase_uid único
y permite hash nulo para cuentas exclusivamente Google, sin borrar usuarios.
Con backend y frontend Online, recargar `/login`: aparecerá CONTINUAR CON GOOGLE.

## Vinculación, roles y sesiones

- Identidad nueva: exclusivamente CLIENT, sin contraseña local.
- Un correo coincidente no fusiona cuentas ni conserva privilegios sin prueba.
  En una cuenta local: entrar con su contraseña y usar VINCULAR ESTA CUENTA CON
  GOOGLE desde Perfil, escribiendo la contraseña actual. El correo Google debe
  estar verificado y coincidir. La vinculación cambia solo firebase_uid, conservando
  UUID, rol y cotizaciones. Si se olvidó la clave local, un operador autorizado debe
  resolver esa cuenta concreta; Google no recupera ni fusiona ese acceso por sí solo.
- Promover a ADMIN sigue siendo una acción explícita del propietario sobre una
  cuenta identificada; el correo de soporte Firebase no concede ese rol.
- Cada petición protegida consulta existencia y rol actuales en PostgreSQL.
  Borrar una cuenta allí rechaza incluso su token anterior; rebajar un rol tampoco
  conserva los privilegios del JWT antiguo.
- Los tokens Google se verifican en cada petición y se renuevan con Firebase,
  sin cambiarlos por JWT locales de siete días. Verificar firma no consulta la
  revocación en tiempo real: eliminar/deshabilitar en Firebase puede tardar hasta
  que expire un ID token emitido (normalmente una hora). Para corte inmediato,
  actuar también sobre la cuenta de negocio PostgreSQL. No se promete revocación
  instantánea desde la consola Firebase.

## Comprobaciones manuales en staging

1. Entrar con Google como CLIENT. Si hay cuenta local con ese correo, comprobar
   el conflicto y usar vinculación con prueba de ambas identidades.
2. Guardar una cotización, recargar, salir y entrar otra vez: misma cuenta e historial.
3. CLIENT no debe acceder a rutas administrativas (403).
4. Tras asignación explícita por el propietario a una segunda cuenta, probar ADMIN
   y gestión de la cotización. No usar una sola cuenta para simular ambos roles.
5. Cancelar popup y comprobar cierre de sesión.

No publicar tokens, hashes, claves privadas ni contraseñas en capturas/logs.
Las pruebas automáticas no crean usuarios Firebase reales ni borran los de Railway.

## Interfaz de acceso, 2026-10-19

Tarjeta compacta de JembaTech inspirada en la referencia del usuario, con pestañas
Iniciar sesión/Registrarse, etiquetas persistentes, autocompletado, control para
mostrar/ocultar la contraseña y Google cuando está habilitado. Mantiene los temas
verde/celeste y un diseño adaptable; no ofrece Apple ni recuperación inexistente.
La X vuelve al inicio. Los accesos locales, Google y el registro correctos regresan
a `/` (menú principal), en lugar de enviar a Perfil. Se conserva un returnUrl interno
cuando se venía de una tarea, especialmente `/#cotizador` para recuperar un armado;
no se aceptan destinos externos. Se bloquean envíos duplicados mientras se espera.

Este ajuste de interfaz no cambia cuentas, roles ni la comprobación de identidad.
**Mejora pendiente solicitada por el usuario:** agilizar la recuperación y resolver
los conflictos entre cuentas locales y Google sin tener que borrar cuentas, con
prueba segura de identidad. No fusionar por correo ni otorgar ADMIN automáticamente.
El nuevo diseño requiere commit/push, CI y despliegue antes de verlo en Railway.

## SDK y pruebas automáticas

SDK web firebase@12.19.0: Node >=20, compatible con Node 22 del proyecto. No usar
Firebase 13 aquí: sus dependencias requieren Node >=24.12. SDK Admin 14.5.0: Node >=22.
Override compatible @grpc/grpc-js@1.14.6 corrige una dependencia transitiva vulnerable
del paquete Firebase. No se desactivan gates ni se usa npm audit fix --force.
Se fijan también los peers @firebase/app@0.16.2 y @firebase/app-compat@0.5.18:
el resolvedor de npm elegía versiones 0.16.3/0.5.19 de Node 24 incluso con SDK 12,
duplicando App respecto a Auth. Un contrato de CI comprueba versiones y engines,
y una prueba Angular inicializa los SDK App/Auth reales sin consultar cuentas.

Backend: configuración opcional, bloqueo de emulador, SDK verificador, correo y
proveedor, CLIENT por defecto, rechazo de fusión por correo, doble prueba al
vincular, unicidad, perfil Google y roles/existencia actuales. Frontend: sesión
solo tras respuesta backend, cancelación, vinculación, token conservado al editar,
renovación, no enviar token a terceros, 403 sin logout y renovación sin fallback.
La prueba Docker firebase-sdk.test.mjs carga el SDK real en Node 22, sin red ni
credenciales, y rechaza algoritmos/audience ajenos; no certifica un login Google válido.

Se estabiliza una fixture de oferta que venció durante estas pruebas: Date.now se
fija solo en su test y se restaura; la caducidad de la aplicación se mantiene.

### Verificación local, 2026-10-18

- Backend: 162 pruebas en 14 suites, build y lint aprobados.
- Frontend: 83 pruebas en 9 archivos, build y lint aprobados; inicialización real
  App/Auth probada con los peers unificados. Imagen final construida con Node 22,
  sin avisos de engine Firebase incompatible.
- Contratos Node de documento, seguridad, Android, CI y proxy aprobados; se agregan
  dos contratos de lockfile Firebase. actionlint y git diff --check sin errores.
- Compose QA aislado: migraciones nuevas, seis tests del cotizador, cuatro programas
  de fixtures, observabilidad, salud de todos los servicios y PostgreSQL efímero
  aprobados. Después del último ajuste exclusivo de peers se reconstruye frontend
  y se comprueba proxy real (rutas, configuración y cambio de IP) con esa imagen.
- SDK Admin real Node 22: prueba Docker sin red/ADC rechaza tokens falsos, algoritmo
  ajeno y audience de otro proyecto. No sustituye una sesión Google válida.
- npm audit de producción: cero hallazgos en frontend y backend. Quedan hallazgos
  previos de herramientas de desarrollo no bloqueantes; no se afirma ausencia de
  vulnerabilidades en todo el proyecto.
- TruffleHog: copia aislada de archivos modificados/nuevos, cero hallazgos. Este
  escaneo de filesystem no se presenta como un escaneo Git del futuro commit.
- Trivy: cinco imágenes aprobadas con todos los CRITICAL y HIGH con parche como
  bloqueantes. Los informes completos conservan hallazgos no bloqueantes.
  Reportes locales ignorados: reports/security/firebase-auth-20261018.
- Redes, contenedores y volumen efímeros QA retirados; tres contenedores originales
  preservados. No se borraron cuentas ni se asignó ADMIN en Railway.

Estado histórico de ese corte (2026-10-18): código aún sin commit/push y prueba
humana pendiente. El usuario confirmó posteriormente CI y el recorrido web
descrito al comienzo; no se atribuye esa comprobación a las pruebas locales.

Referencias: [Google web](https://firebase.google.com/docs/auth/web/google-signin),
[validar ID tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens),
[sesiones y revocación](https://firebase.google.com/docs/auth/admin/manage-sessions),
[configuración pública](https://firebase.google.com/docs/web/learn-more#config-object),
[planes/cuotas](https://firebase.google.com/pricing).
