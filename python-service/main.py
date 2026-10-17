from fastapi import FastAPI
from pydantic import BaseModel, Field

from builds import BuildAnalysis, BuildInput, analyze, recommended_watts

app = FastAPI(title='JembaTech Evaluator', version='0.1.0')


@app.post('/builds/preview', response_model=BuildAnalysis)
def preview_build(build: BuildInput):
    return analyze(build)


class BuildRequest(BaseModel):
    budget: int = Field(gt=0, description='Presupuesto maximo en CLP')
    intended_use: str
    total_price: int = Field(ge=0)
    ram_gb: int = Field(ge=0)
    storage_gb: int = Field(ge=0)
    psu_watts: int = Field(ge=0)
    estimated_consumption_watts: int = Field(ge=0)


class Evaluation(BaseModel):
    score: int
    level: str
    warnings: list[str]
    recommendations: list[str]
    explanation: str


@app.get('/health')
def health():
    return {'status': 'ok', 'service': 'jemba-evaluator'}


@app.post('/evaluate', response_model=Evaluation)
def evaluate(build: BuildRequest):
    score = 100
    warnings: list[str] = []
    recommendations: list[str] = []

    if build.total_price > build.budget:
        score -= 25
        warnings.append('La configuracion supera el presupuesto definido.')
        recommendations.append('Reduce componentes no esenciales o aumenta el presupuesto.')
    if build.psu_watts < recommended_watts(build.estimated_consumption_watts):
        score -= 30
        warnings.append('La fuente de poder no deja margen de seguridad suficiente.')
        recommendations.append('Usa una fuente con 35% de margen, redondeado hacia arriba a 50 W.')
    if build.ram_gb < 16 and build.intended_use.lower() in {'gaming', 'edicion', 'programacion'}:
        score -= 15
        warnings.append('16 GB de RAM es el minimo recomendado para este uso.')
    if build.storage_gb < 500:
        score -= 10
        recommendations.append('Considera al menos 500 GB SSD para sistema, programas y juegos.')

    score = max(score, 0)
    level = 'Excelente' if score >= 85 else 'Aceptable' if score >= 60 else 'Requiere ajustes'
    return Evaluation(
        score=score,
        level=level,
        warnings=warnings,
        recommendations=recommendations,
        explanation='La nota combina presupuesto, margen de potencia, memoria y almacenamiento. Puedes modificar la configuracion y volver a evaluarla.',
    )
