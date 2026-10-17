# Diagrama de contexto — EP2

```mermaid
flowchart LR
  U[Cliente] -->|Armar, guardar, editar y consultar| J[JembaTech]
  A[Administrador] -->|Coordinar y revisar fuentes/calidad| J
  J -->|Consulta CPU puntual y limitada| S[SoloTodo API pública]
  J -. enlace de contacto; sin integración de API .-> W[WhatsApp]
```

SoloTodo aporta referencias técnicas al piloto privado, no un catálogo comercial sincronizado. Acceso técnico no equivale a derechos de reutilización. El cliente no recibe esas referencias como recomendaciones automáticas.

WhatsApp continúa el contacto manual; no se envían automáticamente todas las cotizaciones. La descomposición técnica y los límites de acceso están en [contenedores](diagrama-contenedores.md).
