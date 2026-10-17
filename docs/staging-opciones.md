# Opciones de staging sin contratar todavía

Revisión de documentación oficial: 2026-10-17. **No se ha creado cuenta, verificado elegibilidad, contratado ni desplegado recurso alguno.** Disponibilidad, cuotas y precios pueden cambiar. No hay una garantía de alojamiento permanente gratuito para JembaTech.

| Opción | Lo que publica el proveedor | Encaje / cautela para este proyecto |
| --- | --- | --- |
| [Azure for Students](https://azure.microsoft.com/en-us/free/students/) | US$100 de crédito para estudiantes elegibles, sin tarjeta; oferta con validación académica. | Primera opción a comprobar con el correo universitario del usuario. Permite estudiar un staging que use crédito/cuotas; no significa que todos los recursos sean gratuitos ni que la cuenta ya sea elegible. |
| [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/) | Recursos Always Free dentro de límites y prueba/crédito temporal; disponibilidad sujeta a capacidad y verificación con tarjeta. | Una VM podría alojar Compose con red privada y volumen, pero habría que dimensionar, comprobar arquitectura/imágenes, cupo y condiciones antes de elegir. No asumir disponibilidad o recursos suficientes. |
| [Render Free](https://render.com/docs/free) | Servicios web y PostgreSQL gratuitos con límites: servicios duermen tras 15 min, horas compartidas, base expira a 30 días y sin backups gratuitos. Los web services gratuitos no reciben tráfico privado. | No encaja directamente con nuestra separación privada de Python. Requeriría rediseño o servicios de pago; no se recomienda publicarlo tal cual para obtener una URL rápida. |

## Propuesta, no decisión ejecutada

Primero comprobar **Azure for Students** con el usuario, sin pedirle contraseña o datos de tarjeta. La [oferta oficial](https://azure.microsoft.com/en-us/pricing/offers/ms-azr-0170p/) limita elegibilidad, crédito y cuota; indica suspensión al agotar crédito y una actualización separada para pago por uso. No convertir la suscripción a pago ni contratar servicios fuera del alcance acordado.

Si es elegible, estimar coste/consumo de ejecución, disco, red, base, registro de imágenes y logs antes de aprovisionar. Elegir región/recursos compatibles con las cuotas, fijar límites/alertas, backups, apagado/retirada y fecha de revisión. El crédito no equivale a una prueba técnica de que un tamaño concreto soporte todas las imágenes.

Con proveedor aprobado: definir recursos reales en Terraform, desplegar imágenes identificadas por commit desde Actions y comprobar salud sin exponer PostgreSQL/Python. Staging y release permanecen pendientes en el [tablero](tablero-ep2.md).
