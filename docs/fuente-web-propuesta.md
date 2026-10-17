# Fuente web propuesta y uso responsable - EP1

> Nota EP2 (2026-10-17): esta es la propuesta histórica de EP1, no una exigencia de la profesora. SoloTodo pasa a ser el candidato principal por afinidad con componentes de PC. Su acceso técnico público se comprobó; la reutilización recurrente y los límites siguen por confirmar. Ver [investigación, plan y estado actual](entrega-2.md). Mercado Libre queda como alternativa, no como integración elegida ni validada.

## Decisión

Durante EP1 JembaTech **no consume ni extrae datos automáticamente desde sitios web externos**. La fuente propuesta para una etapa posterior es la [API oficial de Mercado Libre para Chile](https://developers.mercadolibre.cl/), una vez que el titular de JembaTech cree y valide una aplicación en su programa de desarrolladores.

## Propósito futuro

En EP2 la API podría aportar, de manera acotada:

- identificación de productos por nombre, modelo o Part Number;
- atributos técnicos publicados en catálogo;
- precios de referencia y fecha de consulta;
- enlace de origen para que el usuario pueda verificar la información.

La API oficial exige credenciales y permisos de la aplicación; las credenciales se guardarían como Secrets de GitHub y variables de entorno, nunca en el repositorio. Las condiciones aplicables están en los [términos del Programa de Desarrolladores de Mercado Libre Chile](https://developers.mercadolibre.cl/es-cl-terminos-y-condiciones).

## Propuesta adaptativa

El motor FastAPI seguirá siendo responsable de la compatibilidad. Un adaptador futuro en NestJS normalizará los datos autorizados a un catálogo interno con campos como `partNumber`, socket, RAM, potencia, precio de referencia y fecha de actualización. Con esos datos, el evaluador podrá:

1. filtrar componentes incompatibles;
2. priorizar configuraciones dentro del presupuesto;
3. explicar por qué recomienda o descarta una alternativa;
4. mostrar la fecha y el enlace de origen de cada referencia externa.

No se usará un precio externo como promesa de venta ni se tomará una decisión automática sin mostrar su explicación al cliente.

## Límites de EP1

- No hay scraping, robots automatizados ni carga masiva de sitios de terceros.
- No se almacenan datos personales obtenidos desde fuentes externas.
- SoloTodo puede usarse como comparación manual de mercado por el administrador, pero no se integrará hasta confirmar un mecanismo autorizado.
- Instagram se conectará únicamente mediante la API oficial de una cuenta profesional autorizada, si se incorpora en una etapa posterior.

## Condiciones antes de implementar EP2

1. Crear una aplicación de Mercado Libre asociada al titular de JembaTech.
2. Revisar permisos, límites y términos vigentes.
3. Crear una interfaz de adaptador en NestJS y pruebas con respuestas simuladas.
4. Agregar caché, trazabilidad de fecha/origen y manejo de errores.
5. Documentar el impacto en privacidad, seguridad y presupuesto.
