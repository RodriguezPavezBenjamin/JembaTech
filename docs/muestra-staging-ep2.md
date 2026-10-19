# Muestra real para la demostración de staging

Preparación del 2026-10-19, autorizada por el propietario. **Carga en Railway y
visualización de las cinco fichas confirmadas mediante capturas del propietario**.
El panel inicialmente tenía cero referencias; no se activó la consulta externa.

## Procedencia y comprobación

Se leyó únicamente la corrida local `0c301597-c4de-46d7-8e5a-44818bfef04d` y sus
cinco referencias CPU `10349`, `10350`, `13833`, `7223`, `8914`, guardadas como
`manual-api`, estado SUCCEEDED, recuperación `2026-10-17T06:42:03.974Z`.
No se leyeron cuentas, contraseñas ni cotizaciones; no se hicieron escrituras.

El JSON para el formulario se reconstruyó a partir de los **campos normalizados
persistidos**, no de un supuesto archivo bruto original. Se conservaron IDs,
nombres, marca, Part Number ausente, socket, núcleos/hilos, TDP declarado y fecha
de actualización de cada ficha. No se añadieron imágenes, precios ni atributos
inferidos. El normalizador CPU local aprobó cinco registros, sin rechazados ni
duplicados, y reprodujo **las cinco huellas de contenido originales**, con las
mismas fechas de recuperación y actualización.

El primer verificador comparó el texto ISO de fechas con distinta precisión
(milisegundos/microsegundos) y no aprobó; se corrigió la comparación de instantes
y se repitió con éxito. No se cambió ninguna fecha para forzar el resultado.

Resultado de la validación local, sin red externa ni persistencia:

```json
{"status":"ok","records":5,"accepted":5,"rejected":0,"duplicates":0,"originalHashesMatched":5,"originalDatesMatched":true,"externalRequests":0,"databaseWrites":0}
```

Archivo local ignorado: `reports/closing-ep2/muestra-cpu-real.json`. No se publica
el lote en Git; el repositorio conserva solo la descripción sanitizada. No
confundir estos modelos antiguos AMD/FM2 con catálogo vigente o cobertura útil
de plataformas actuales. [Evaluación original y límites](fuente-web-evaluacion.md).

## Carga por la cuenta ADMIN del propietario

1. Copiar todo el JSON del archivo, sin el nombre del archivo ni Markdown.
2. En staging → Fuentes y calidad, expandir **Herramienta avanzada: validar
   muestra JSON**. Pegar en **JSON de la muestra**.
3. Pulsar una sola vez **Validar y guardar muestra**. Esto ejecuta Angular →
   NestJS → normalizador CPU en FastAPI → PostgreSQL → listado Angular, sin
   consultar SoloTodo ni modificar catálogo/cotizaciones.
4. Revisar el mensaje, las referencias y la ejecución **Muestra JSON**. Compartir
   el resultado; no repetir si hay error ni habilitar el piloto para resolverlo.

## Resultado visual confirmado

Las capturas muestran los cinco IDs esperados, paginación **5 fichas · página 1
de 1**, nombres/especificaciones, fecha de recuperación original y actualización
de origen. La ficha 8914 muestra la huella original
`1926c5a47a4f96b605f6c85cf46ec50feb2a8afb18c22a49bc18f2a50557aa87`
y el texto **Muestra declarada por administrador. Derechos de reutilización
pendientes.** Las advertencias de 150 días de antigüedad, Part Number ausente,
precio sin verificar y falta de vínculo al catálogo permanecen visibles.

Esto acredita datos persistidos y visualizados por el flujo de muestra en staging.
No es una extracción API nueva: la adquisición real sigue siendo la corrida local
citada. Las capturas no muestran el detalle de métricas de la nueva ejecución;
los cinco aceptados/cero rechazados y duplicados de la validación offline no se
presentan como medición nueva de Railway. No hace falta repetir la carga.
No trasladar cuentas, creadores ni IDs de corrida al formulario.
