import os

# Testes usam SQLite em memória para não tocar no banco real.
os.environ["DATABASE_URL"] = "sqlite://"
os.environ.setdefault("JWT_SECRET", "chave-de-teste-com-pelo-menos-32-bytes")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import main
import models
from database import get_db
from main import app

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)

def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

@pytest.fixture(autouse=True)
def banco_limpo(tmp_path, monkeypatch):
    models.Base.metadata.drop_all(bind=engine)
    models.Base.metadata.create_all(bind=engine)
    monkeypatch.setattr(main, "UPLOADS_DIR", tmp_path)

def auth(token):
    return {"Authorization": f"Bearer {token}"}

def cadastrar_jovem(email="ana@ex.com", descricao="gosto de organizar documentos e rotinas administrativas"):
    res = client.post("/jovens/", json={
        "nome": "Ana", "email": email, "senha": "senha123", "descricao": descricao,
        "aceitou_lgpd": True, "aceitou_lei_aprendizagem": True,
    })
    assert res.status_code == 201, res.text
    return res.json()["token"]

def cadastrar_empresa(email="rh@tech.com", **extra):
    res = client.post("/empresas/", json={"nome": "TechCorp", "email": email, "senha": "senha123", **extra})
    assert res.status_code == 201, res.text
    return res.json()["token"]

def criar_vaga(token, titulo="Assistente Administrativo", descricao="auxiliar nas rotinas administrativas e organizar documentos"):
    res = client.post("/vagas/", json={"titulo": titulo, "descricao": descricao}, headers=auth(token))
    assert res.status_code == 201, res.text
    return res.json()["id"]

def test_saude():
    assert client.get("/saude").json()["status"] == "ok"

# ---------- Semana 3 ----------

def test_cadastro_bloqueado_sem_aceite_lgpd():
    res = client.post("/jovens/", json={
        "nome": "Bia", "email": "bia@ex.com", "senha": "senha123", "descricao": "x",
        "aceitou_lgpd": False, "aceitou_lei_aprendizagem": True,
    })
    assert res.status_code == 400

def test_senha_salva_com_hash():
    cadastrar_jovem()
    db = TestingSession()
    jovem = db.query(models.JovemAprendiz).one()
    assert jovem.senha_hash != "senha123" and jovem.senha_hash.startswith("$2")
    db.close()

def test_email_duplicado_retorna_409():
    cadastrar_jovem()
    res = client.post("/jovens/", json={
        "nome": "Ana 2", "email": "ANA@ex.com ", "senha": "senha123", "descricao": "x",
        "aceitou_lgpd": True, "aceitou_lei_aprendizagem": True,
    })
    assert res.status_code == 409

def test_validacoes_de_cadastro():
    assert client.post("/empresas/", json={"nome": "X Ltda", "email": "nao-e-email", "senha": "senha123"}).status_code == 422
    assert client.post("/empresas/", json={"nome": "X Ltda", "email": "x@x.com", "senha": "123"}).status_code == 422
    assert client.post("/empresas/", json={"nome": "X Ltda", "email": "x@x.com", "senha": "senha123", "cnpj": "123"}).status_code == 422

def test_login():
    cadastrar_jovem()
    ok = client.post("/login", json={"email": "ana@ex.com", "senha": "senha123", "tipo": "jovem"})
    assert ok.status_code == 200 and ok.json()["usuario"]["nome"] == "Ana"
    assert "senha_hash" not in ok.json()["usuario"]
    assert client.post("/login", json={"email": "ana@ex.com", "senha": "errada", "tipo": "jovem"}).status_code == 401
    assert client.post("/login", json={"email": "ana@ex.com", "senha": "senha123", "tipo": "empresa"}).status_code == 401

def test_rotas_protegidas():
    token_jovem = cadastrar_jovem()
    assert client.get("/jovens/me").status_code == 401
    assert client.get("/jovens/me", headers=auth("token-falso")).status_code == 401
    assert client.get("/empresas/me", headers=auth(token_jovem)).status_code == 403

def test_atualizar_perfis():
    token = cadastrar_jovem()
    res = client.patch("/jovens/me", json={"cidade": "Recife", "data_nascimento": "2008-05-10"}, headers=auth(token))
    assert res.json()["cidade"] == "Recife" and res.json()["data_nascimento"] == "2008-05-10"

    token_empresa = cadastrar_empresa()
    res = client.patch("/empresas/me", json={"cnpj": "12.345.678/0001-90", "total_funcionarios": 50}, headers=auth(token_empresa))
    assert res.json()["cnpj"] == "12345678000190"

def test_upload_curriculo_e_video():
    token = cadastrar_jovem()
    res = client.post("/jovens/me/curriculo", files={"arquivo": ("cv.pdf", b"%PDF-1.4 teste", "application/pdf")}, headers=auth(token))
    assert res.status_code == 200
    url = res.json()["curriculo_url"]

    assert client.get(url, headers=auth(token)).content == b"%PDF-1.4 teste"
    assert client.get(url).status_code == 401
    outro_jovem = cadastrar_jovem(email="outro@ex.com")
    assert client.get(url, headers=auth(outro_jovem)).status_code == 404
    assert client.get(url, headers=auth(cadastrar_empresa())).status_code == 200

    errado = client.post("/jovens/me/curriculo", files={"arquivo": ("x.exe", b"MZ", "application/octet-stream")}, headers=auth(token))
    assert errado.status_code == 400
    video = client.post("/jovens/me/video", files={"arquivo": ("v.mp4", b"0000", "video/mp4")}, headers=auth(token))
    assert video.status_code == 200

# ---------- Semana 4 ----------

def test_vagas_da_empresa():
    token = cadastrar_empresa()
    vaga_id = criar_vaga(token)
    assert client.post("/vagas/", json={"titulo": "X", "descricao": "curta"}, headers=auth(token)).status_code == 422
    assert client.post("/vagas/", json={"titulo": "Vaga", "descricao": "descricao valida aqui"}, headers=auth(cadastrar_jovem())).status_code == 403

    outra = cadastrar_empresa(email="outra@ex.com")
    assert client.patch(f"/vagas/{vaga_id}", json={"aberta": False}, headers=auth(outra)).status_code == 403

    assert len(client.get("/vagas/?busca=administrativo").json()) == 1
    assert len(client.get("/vagas/?busca=techcorp").json()) == 1
    assert client.patch(f"/vagas/{vaga_id}", json={"aberta": False}, headers=auth(token)).json()["aberta"] is False
    assert client.get("/vagas/").json() == []

def test_candidatura_e_cota():
    empresa = cadastrar_empresa(total_funcionarios=30)
    vaga_id = criar_vaga(empresa)
    jovem = cadastrar_jovem()

    assert client.post(f"/vagas/{vaga_id}/candidaturas", headers=auth(jovem)).status_code == 201
    assert client.post(f"/vagas/{vaga_id}/candidaturas", headers=auth(jovem)).status_code == 409

    recebidas = client.get("/empresas/me/candidaturas", headers=auth(empresa)).json()
    assert recebidas[0]["candidato"]["nome"] == "Ana" and recebidas[0]["compatibilidade"] > 0

    cota = client.get("/empresas/me/cota", headers=auth(empresa)).json()
    assert (cota["cota_minima"], cota["cota_maxima"], cota["contratados"]) == (2, 4, 0)  # 30 × 5% = 1,5 → 2

    assert client.patch(f"/candidaturas/{recebidas[0]['id']}", json={"status": "aprovado"}, headers=auth(empresa)).status_code == 422
    client.patch(f"/candidaturas/{recebidas[0]['id']}", json={"status": "contratado"}, headers=auth(empresa))
    cota = client.get("/empresas/me/cota", headers=auth(empresa)).json()
    assert (cota["contratados"], cota["faltam_para_cota_minima"]) == (1, 1)
    assert client.get("/jovens/me/candidaturas", headers=auth(jovem)).json()[0]["status"] == "contratado"

def test_filtro_inteligente_ordena_por_compatibilidade():
    empresa = cadastrar_empresa()
    criar_vaga(empresa, "Auxiliar de Logística", "separar mercadorias no estoque e conferir notas fiscais")
    criar_vaga(empresa, "Assistente Administrativo", "organizar documentos e arquivos do escritório")
    jovem = cadastrar_jovem(descricao="Sou organizada, gosto de arquivar documentos e trabalhar em escritório")

    recomendacoes = client.get("/jovens/me/recomendacoes", headers=auth(jovem)).json()
    assert recomendacoes[0]["titulo"] == "Assistente Administrativo"
    assert recomendacoes[0]["compatibilidade"] > recomendacoes[1]["compatibilidade"]

    candidatos = client.get("/empresas/me/candidatos", headers=auth(empresa)).json()
    assert candidatos[0]["candidato_nome"] == "Ana" and candidatos[0]["vaga_titulo"] == "Assistente Administrativo"

def test_filtro_ignora_acentos_e_palavras_comuns():
    from matcher import calcular_compatibilidades
    assert calcular_compatibilidades("atendimento ao público", ["atendimento ao publico"])[0] == 100.0
    assert calcular_compatibilidades("de para com", ["de para com"]) == [0.0]
    assert calcular_compatibilidades("", ["qualquer coisa"]) == [0.0]
