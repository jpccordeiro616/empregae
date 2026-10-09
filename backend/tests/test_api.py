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

def test_saude():
    assert client.get("/saude").json()["status"] == "ok"

def test_fluxo_cadastro_vaga_e_match():
    jovem = client.post("/jovens/", json={
        "nome": "Ana", "email": "ana@ex.com", "senha": "123",
        "descricao": "gosto de organizar documentos e rotinas administrativas",
        "aceitou_lgpd": True, "aceitou_lei_aprendizagem": True,
    })
    assert jovem.status_code == 200
    empresa = client.post("/empresas/", json={"nome": "TechCorp", "email": "rh@tech.com", "senha": "123"})
    assert empresa.status_code == 200
    vaga = client.post("/vagas/", json={
        "titulo": "Assistente Administrativo",
        "descricao": "auxiliar nas rotinas administrativas e organizar documentos",
        "empresa_id": empresa.json()["id"],
    })
    assert vaga.status_code == 200

    recomendadas = client.get(f"/vagas/recomendadas/{jovem.json()['id']}").json()
    assert recomendadas[0]["titulo"] == "Assistente Administrativo"
    assert recomendadas[0]["compatibilidade"] > 0

    candidatos = client.get(f"/empresas/{empresa.json()['id']}/candidatos").json()
    assert candidatos[0]["candidato_nome"] == "Ana"

def test_cadastro_bloqueado_sem_aceite_lgpd():
    res = client.post("/jovens/", json={
        "nome": "Bia", "email": "bia@ex.com", "senha": "123", "descricao": "x",
        "aceitou_lgpd": False, "aceitou_lei_aprendizagem": True,
    })
    assert res.status_code == 400
