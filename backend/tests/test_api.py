import os

# Testes usam SQLite em memória para não tocar no banco real.
os.environ["DATABASE_URL"] = "sqlite://"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import models
from database import get_db
from main import app

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)
models.Base.metadata.create_all(bind=engine)

def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

def test_health():
    assert client.get("/health").json()["status"] == "ok"

def test_fluxo_cadastro_vaga_e_match():
    jovem = client.post("/apprentices/", json={
        "name": "Ana", "email": "ana@ex.com", "password": "123",
        "description": "gosto de organizar documentos e rotinas administrativas",
        "accepted_lgpd": True, "accepted_aprendizagem": True,
    })
    assert jovem.status_code == 200
    empresa = client.post("/companies/", json={"name": "TechCorp", "email": "rh@tech.com", "password": "123"})
    assert empresa.status_code == 200
    vaga = client.post("/vacancies/", json={
        "title": "Assistente Administrativo",
        "description": "auxiliar nas rotinas administrativas e organizar documentos",
        "company_id": empresa.json()["id"],
    })
    assert vaga.status_code == 200

    matches = client.get(f"/vacancies/match/{jovem.json()['id']}").json()
    assert matches[0]["title"] == "Assistente Administrativo"
    assert matches[0]["match_score"] > 0

    candidatos = client.get(f"/companies/{empresa.json()['id']}/candidates").json()
    assert candidatos[0]["candidate_name"] == "Ana"

def test_cadastro_bloqueado_sem_aceite_lgpd():
    res = client.post("/apprentices/", json={
        "name": "Bia", "email": "bia@ex.com", "password": "123", "description": "x",
        "accepted_lgpd": False, "accepted_aprendizagem": True,
    })
    assert res.status_code == 400
