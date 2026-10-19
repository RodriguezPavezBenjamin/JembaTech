from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health_reports_service_status():
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json()['status'] == 'ok'


def test_health_reports_only_valid_commit_metadata(monkeypatch):
    monkeypatch.setenv('RAILWAY_GIT_COMMIT_SHA', 'a' * 40)
    assert client.get('/health').json() == {'status': 'ok', 'service': 'jemba-evaluator', 'commit': 'a' * 40}


def test_health_does_not_expose_arbitrary_environment_content(monkeypatch):
    monkeypatch.setenv('RAILWAY_GIT_COMMIT_SHA', 'invalid-private-value')
    assert client.get('/health').json()['commit'] == 'local'


def test_evaluation_warns_when_budget_and_power_are_insufficient():
    response = client.post('/evaluate', json={
        'budget': 500000, 'intended_use': 'gaming', 'total_price': 700000,
        'ram_gb': 8, 'storage_gb': 256, 'psu_watts': 400,
        'estimated_consumption_watts': 400,
    })
    assert response.status_code == 200
    assert response.json()['score'] < 100
