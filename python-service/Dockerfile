FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .
COPY builds.py .
COPY solotodo.py .
COPY solotodo_components.py .
COPY solotodo_prices.py .
COPY solotodo_catalog.py catalog_scope.json ./
COPY probe_solotodo.py .
COPY observability.py .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
