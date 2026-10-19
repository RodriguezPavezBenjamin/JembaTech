# Corrección de fixtures detectadas por TruffleHog — 18/10/2026

El usuario publicó `2aa3d1706ab40fd5fc77b95b2773cde2c722eace`. El job secrets bloqueó dos resultados URI no verificados en `backend/src/catalog/catalog.pricing.spec.ts:30` y `python-service/tests/test_solotodo_prices.py:47`.

## Causa y corrección

Son fixtures negativas sintéticas: URLs con userinfo para comprobar que el normalizador rechaza ofertas con usuario/contraseña. No son cuentas de un proveedor real; estos tests no hacen peticiones de red. El formato literal activó el detector URI. No se publican sus valores en este documento.

- Las pruebas actuales construyen esas URLs en ejecución con una contraseña aleatoria efímera, usando URL/urlunsplit. No se ofusca una credencial real ni se elimina el caso negativo.
- Se añadió una prueba en cada lenguaje que confirma que el host y los demás atributos siguen siendo válidos, y que la presencia de credenciales continúa siendo rechazada. No se cambia el código de producción ni se consulta SoloTodo.
- El historial completo conserva las dos fixtures del commit publicado. Se registraron en la baseline por detector, commit, archivo, línea y SHA-256 exactos, con justificación. Solo resultados no verificados e idénticos se aceptan como QA histórico; no se excluye ningún archivo, detector ni rango.
- El validador admite las entradas históricas URI además de las Postgres existentes. Sigue bloqueando un nuevo commit, ruta, línea o huella, cualquier resultado verificado, otro detector y los errores del scanner. Tres pruebas nuevas cubren esas restricciones y la ausencia de Raw en la salida.
- Se conservan imagen/digest TruffleHog, --fail, --fail-on-scan-errors, --no-ignore-tag y --results=verified,unknown. No se añaden etiquetas de ignore ni continue-on-error.

## Verificación

- Backend: ESLint y 22 pruebas de precios aprobados.
- Python: Ruff y 27 pruebas de precios aprobados en una copia temporal sin red. Un aviso previo de deprecación del TestClient no bloquea.
- Gate de secretos: siete pruebas aprobadas, incluyendo verificadas, identidad cambiada, hallazgos mixtos y errores del scanner.
- Repetición completa posterior: 140 pruebas backend en once suites, 199 Python, cinco del coordinador Bash y 57 controles Node aprobados; diff --check sin errores. Las cifras anteriores de suites enfocadas se conservan como pasos intermedios.
- Se creó una copia Git QA aislada dentro de reports/ con el historial real y un snapshot candidato. Los commits QA no pertenecen al repositorio del usuario; el HEAD y el índice principales se conservaron.
- TruffleHog real, mismas opciones y digest de CI: rango desde 2aa3d17 al candidato, cero hallazgos. Historial completo: cinco hallazgos QA históricos exactos y no verificados (tres Postgres anteriores y estas dos URI), aceptados por la baseline; cero bloqueantes. No equivale a afirmar ausencia general de secretos.
- JSONL/diagnósticos privados y snapshot QA permanecen bajo reports/, ignorados por Git. No imprimir ni subir Raw como artifact.

La comprobación local no reemplaza el nuevo run remoto. No se hizo commit/push ni se reescribió historial en el repositorio principal. Railway/staging y release siguen pendientes.

## Commit de corrección

```powershell
Set-Location "S:\Accesos SSD\Desktop\WEB ADVANCED\Primera entrega"
git add -- .github/security/secret-baseline.json scripts/check-secrets.mjs tests/security/secrets.test.mjs backend/src/catalog/catalog.pricing.spec.ts python-service/tests/test_solotodo_prices.py docs
git diff --cached --check
git diff --cached --stat
git commit -m "fix(ci): corrige fixtures URI en el escaneo de secretos"
git push origin main
```

Revisar secrets en el run del nuevo SHA. El run fallido de 2aa3d17 se conserva como evidencia; no hace falta repetir ese commit sin los cambios de corrección.
