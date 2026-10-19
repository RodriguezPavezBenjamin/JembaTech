# Trabajos de Instagram en la portada

Selección manual del 18/10/2026, ampliada a **ocho publicaciones**. El usuario proporcionó siete enlaces iniciales y después `DepvUVoGPre`. No es una nueva fuente de datos de EP2, un feed automático ni una integración autenticada con la API de Meta. No modifica SoloTodo, el catálogo, los usuarios ni las cotizaciones.

## Publicaciones y correspondencias revisadas

Se abrieron las ocho páginas en Chrome sin iniciar sesión y se comprobaron fecha, texto y fotografía visibles. Los resúmenes de la portada se basan en esos textos, sin reproducir comentarios de terceros, nombres de clientes ni cifras de rendimiento.

| Publicación original | Fecha visible | Trabajo / respaldo local |
| --- | --- | --- |
| [CgCuAqsu5Ph](https://www.instagram.com/jemba_tech/p/CgCuAqsu5Ph/) | 15/07/2022 | Cambio HDD a SSD en notebook; foto local `SnapInsta.to_655226020_18094345324843970_8152732067528020249_n.jpg`. |
| [CVocA74lHD8](https://www.instagram.com/jemba_tech/p/CVocA74lHD8/) | 29/10/2021 | Sistema operativo, drivers y orientación de uso; foto local `SnapInsta.to_622149211_18074393702091806_7019796454176246559_n.jpg`. |
| [CTTRZEbL9n9](https://www.instagram.com/jemba_tech/p/CTTRZEbL9n9/) | 01/09/2021 | SSD M.2 en notebook; foto local `SnapInsta.to_650732347_18071241107204990_4165742315428070953_n.jpg`. |
| [CnQzTZQONxr](https://www.instagram.com/jemba_tech/p/CnQzTZQONxr/) | 10/01/2023 | Mantenimiento, limpieza y formateo; foto local `SnapInsta.to_653363037_18082775180353377_7455241835060939604_n.jpg`. |
| [CudDs9GJqBR](https://www.instagram.com/jemba_tech/p/CudDs9GJqBR/) | 08/07/2023 | Armado Ryzen 5700X / RTX 3060 / 16 GB; foto local `SnapInsta.to_649393137_17978679602825836_1167495615100214261_n.jpg`. |
| [CvssFaaJRx7](https://www.instagram.com/jemba_tech/p/CvssFaaJRx7/) | 08/08/2023 | Cambio a Kolink Observatory Lite Mesh RGB; `instagram-CvssFaaJRx7.jpg`. |
| [C5CK9F_JbCD](https://www.instagram.com/jemba_tech/p/C5CK9F_JbCD/) | 27/03/2024 | Armado Ryzen 7 7700 / Radeon 5500 XT; `instagram-C5CK9F_JbCD.jpg`. |
| [DepvUVoGPre](https://www.instagram.com/jemba_tech/p/DepvUVoGPre/) | 18/10/2026, según fecha visible al revisar | Limpieza y cambio de pasta térmica en PCs; `instagram-DepvUVoGPre.jpg`. |

Las ocho tarjetas tienen foto. Cinco miniaturas reutilizan las imágenes del proyecto. Las dos portadas gráficas iniciales se sustituyeron por sus fotos originales y se añadió la del nuevo post, bajo la petición del usuario. Las tres nuevas imágenes se inspeccionaron visualmente y se guardaron en `frontend/public/media/portfolio/`, con nombre estable por ID. No se versionan enlaces efímeros del CDN, cookies o credenciales. Las descargas del navegador fueron lentas; dos archivos sí se guardaron y la portada de Kolink se recuperó de la URL de imagen pública observada en el DOM, sin sesión autenticada.

## Comportamiento y privacidad

- La portada muestra ocho trabajos en un carrusel 3D: una tarjeta central legible y dos tarjetas inclinadas detrás a cada lado. Conserva verde/azul, foto, fecha, resumen y enlace permanente. No se etiquetan como los últimos ni como datos actualizados automáticamente.
- Presentación simplificada: título centrado «Trabajos de JembaTech», divisor como el resto de secciones e icono circular de Instagram con nombre accesible. Tarjetas ampliadas de 380 a 520 px como máximo (88% en móvil), sin marco exterior, párrafos explicativos, botón de pausa ni contador visible. Solo se conservaron los contenedores de maquetación, sin borde o fondo general.
- Avance circular cada cinco segundos y dos flechas a media altura en los laterales de la tarjeta central. Inicio/Fin y flechas izquierda/derecha sobre el contenedor; no se interceptan teclas sobre enlaces. Deslizar horizontalmente también cambia la tarjeta; no se convierte el desplazamiento vertical en navegación.
- Se suspende por cursor, foco dentro del carrusel, pestaña oculta o fuera de vista. Navegar manualmente reinicia el temporizador; al abandonar el control se puede continuar sin un botón de reanudación. Espacio sobre el contenedor pausa/reanuda; esa instrucción está en su descripción accesible, sin añadir texto visible. Movimiento reducido desactiva el avance y las transiciones, incluso al pulsar Espacio.
- Solo la tarjeta central admite interacción y lectura asistida; las posteriores llevan `inert` y `aria-hidden`. Sin JavaScript quedan las ocho tarjetas desplazables con enlaces utilizables.
- «Ver publicación» abre el original con `noopener noreferrer`. No hay botones de Me gusta/comentarios falsos ni testimonios inventados.
- El acceso al original funciona con enlaces HTML, también sin JavaScript. No se necesitan claves de API ni se pide iniciar sesión dentro de JembaTech.
- No se crean iframes, no se carga `embed.js` ni se contacta Instagram por abrir la portada. Las fotos y resúmenes están disponibles sin cookies ni scripts de Meta. La visita a Instagram queda a decisión del visitante; allí aplican sus restricciones y opciones de privacidad.
- Si la publicación se retira o restringe, el enlace también puede dejar de ser útil: revisar manualmente la selección. No se promete acceso permanente sin registro.
- Por petición del usuario se eliminaron la tira horizontal anterior, el archivo plegado de 13 fotos y su modal, junto con sus estilos y controlador. No se borraron imágenes compartidas con presets/cotizador.

La vista de inserción de `C5CK9F_JbCD` se abrió directamente en Chrome sin sesión, pero las pruebas dentro de un iframe en JembaTech quedaron en blanco tanto con esa publicación como con `CgCuAqsu5Ph`. No se determinó la causa. Se retiró la opción incrustada antes de entregar: que abra como página independiente no demuestra que funcione incrustada. No se desactivaron protecciones del navegador ni se añadieron intermediarios. Queda pendiente verificar la inserción oficial en staging si se desea retomarla.

Publicar una foto no sustituye el consentimiento de las personas retratadas: conservar su autorización y retirar enlaces/fotos si corresponde.

## Validación

`tests/integration/document.test.mjs` cubre fuente y HTML compilado: ocho destinos exactos, fechas, ocho fotos locales con firma raster comprobada, enlaces sin JavaScript y ausencia de widgets/recursos de Meta. Incluye vuelta circular, teclado, tarjeta central interactiva, autoplay con reloj simulado, pausas por cursor/foco/visibilidad, movimiento reducido y gestos sintéticos. Verifica la retirada de la galería y modal anteriores. No sustituye una comprobación móvil real. Los tests sin red no validan la disponibilidad de Instagram: esa comprobación puntual se hizo en Chrome.

Compilar el frontend antes de ejecutar la prueba, como hace el workflow:

```powershell
Set-Location frontend
npm.cmd run build
Set-Location ..
node --test tests/integration/document.test.mjs
```

No se hizo commit/push, despliegue ni publicación en Instagram por esta implementación.

Resultado del primer corte: 15 pruebas del documento y 35 controles combinados aprobados. Tras el carrusel y las fotos: build Angular, **19 pruebas del documento y 39 controles combinados aprobados**, diff sin errores. Revisión visual en Chrome del panel «¿Por qué yo?» opaco con variables de tema, verde y azul, y del carrusel. No se declara una comprobación móvil real o de staging.

Sustitución posterior por carrusel 3D: **build Angular y 41 controles combinados aprobados**, incluidos 21 del documento, sin errores de diff. Las pruebas de la galería retirada se sustituyeron por navegación circular, autoplay, pausas, preferencias de movimiento y gestos del nuevo carrusel. Revisión en Chrome de la composición verde/azul, avance automático y navegación hasta la octava publicación. No implica nueva CI, staging o prueba móvil real.

Ajuste posterior de la sección previa: «¿Por qué JembaTech?» queda fuera del panel de cifras; las tres ventajas son tarjetas independientes. Se conservan las cuatro cifras y las variables de ambos temas. **Build y 43 controles combinados aprobados**, incluidos 23 del documento con comprobación de esa separación en fuente y compilado. La adaptación 2×2 para cifras móviles está cubierta por estructura/CSS; no es una prueba en dispositivo real.

Simplificación visual posterior: **build y 45 controles combinados aprobados**, incluidos 25 del documento sobre fuente y compilado. Comprueba ausencia de contador/botón/párrafos retirados, icono accesible, título, ancho y reglas de posición de flechas, además del autoplay/teclado/gestos. En Chrome se midió una tarjeta central de 520 px y ambas flechas centradas verticalmente en sus laterales. No acredita prueba móvil real, nueva CI ni despliegue.
