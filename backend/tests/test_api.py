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
def banco_limpo():
    models.Base.metadata.drop_all(bind=engine)
    models.Base.metadata.create_all(bind=engine)

def nascido_ha(anos, dias_a_mais=0):
    """Data de nascimento de quem fez `anos` anos hoje (menos `dias_a_mais` dias de vida)."""
    from datetime import date, timedelta
    hoje = date.today()
    try:
        nascimento = hoje.replace(year=hoje.year - anos)
    except ValueError:  # 29/02
        nascimento = hoje.replace(year=hoje.year - anos, day=28)
    return (nascimento + timedelta(days=dias_a_mais)).isoformat()

def auth(token):
    return {"Authorization": f"Bearer {token}"}

def cadastrar_jovem(email="ana@ex.com", descricao="gosto de organizar documentos e rotinas administrativas"):
    res = client.post("/jovens/", json={
        "nome": "Ana", "email": email, "senha": "senha123", "descricao": descricao,
        "aceitou_lgpd": True, "aceitou_lei_aprendizagem": True, "data_nascimento": nascido_ha(20),
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
        "aceitou_lgpd": False, "aceitou_lei_aprendizagem": True, "data_nascimento": nascido_ha(20),
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
        "aceitou_lgpd": True, "aceitou_lei_aprendizagem": True, "data_nascimento": nascido_ha(20),
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
    # A data de nascimento é ignorada na edição: ela define as regras de idade do cadastro.
    assert res.json()["cidade"] == "Recife" and res.json()["data_nascimento"] == nascido_ha(20)

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
    empresa = cadastrar_empresa()
    assert client.get(url, headers=auth(empresa)).status_code == 404  # ainda não se candidatou
    client.post(f"/vagas/{criar_vaga(empresa)}/candidaturas", headers=auth(token))
    assert client.get(url, headers=auth(empresa)).status_code == 200

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

# ---------- Semana 7 ----------

def test_organograma_calcula_base_da_cota():
    empresa = cadastrar_empresa()
    assert client.get("/empresas/me/organograma", headers=auth(empresa)).json()["setores"] == []

    res = client.put("/empresas/me/organograma", headers=auth(empresa), json={"setores": [
        {"nome": "Produção", "funcionarios": 30, "exige_formacao": True},
        {"nome": "Administrativo", "funcionarios": 12, "exige_formacao": True},
        {"nome": "Diretoria", "funcionarios": 3, "exige_formacao": False},
    ]})
    assert res.status_code == 200
    assert (res.json()["total_funcionarios"], res.json()["base_cota"]) == (45, 42)

    cota = client.get("/empresas/me/cota", headers=auth(empresa)).json()
    assert (cota["total_funcionarios"], cota["cota_minima"], cota["cota_maxima"]) == (42, 3, 6)  # 42 × 5% = 2,1 → 3

    # Salvar de novo substitui os setores anteriores
    res = client.put("/empresas/me/organograma", headers=auth(empresa), json={"setores": [{"nome": "Loja", "funcionarios": 20}]})
    assert len(res.json()["setores"]) == 1
    assert client.get("/empresas/me/cota", headers=auth(empresa)).json()["cota_minima"] == 1

def test_organograma_validacoes_e_permissao():
    empresa = cadastrar_empresa()
    ruim = client.put("/empresas/me/organograma", headers=auth(empresa), json={"setores": [{"nome": "X", "funcionarios": -1}]})
    assert ruim.status_code == 422
    assert client.put("/empresas/me/organograma", headers=auth(cadastrar_jovem()), json={"setores": []}).status_code == 403

def test_candidatos_compativeis_trazem_curriculo_e_candidatura():
    empresa = cadastrar_empresa()
    vaga_id = criar_vaga(empresa)
    jovem = cadastrar_jovem()
    client.post("/jovens/me/curriculo", files={"arquivo": ("cv.pdf", b"%PDF-1.4", "application/pdf")}, headers=auth(jovem))
    client.post(f"/vagas/{vaga_id}/candidaturas", headers=auth(jovem))

    candidato = client.get("/empresas/me/candidatos", headers=auth(empresa)).json()[0]
    assert candidato["ja_candidatou"] is True and candidato["curriculo_url"].startswith("/arquivos/")

def test_perfil_publico_da_empresa():
    empresa = cadastrar_empresa(cnpj="12345678000190", total_funcionarios=40)
    res = client.patch("/empresas/me", headers=auth(empresa), json={
        "descricao": "Rede de supermercados do Recife.", "cidade": "Recife - PE",
        "area_atuacao": "Varejo", "site": "www.bompreco.com.br",
    })
    assert res.json()["site"] == "https://www.bompreco.com.br"
    vaga_aberta = criar_vaga(empresa)
    vaga_fechada = criar_vaga(empresa, titulo="Vaga encerrada")
    client.patch(f"/vagas/{vaga_fechada}", json={"aberta": False}, headers=auth(empresa))

    empresa_id = client.get("/empresas/me", headers=auth(empresa)).json()["id"]
    perfil = client.get(f"/empresas/{empresa_id}/perfil").json()
    assert perfil["area_atuacao"] == "Varejo"
    assert [v["id"] for v in perfil["vagas_abertas"]] == [vaga_aberta]
    for privado in ("email", "cnpj", "total_funcionarios", "senha_hash"):
        assert privado not in perfil
    assert client.get("/empresas/999/perfil").status_code == 404

def test_site_da_empresa_so_aceita_http():
    empresa = cadastrar_empresa()
    assert client.patch("/empresas/me", headers=auth(empresa), json={"site": "javascript:alert(1)"}).status_code == 422
    assert client.patch("/empresas/me", headers=auth(empresa), json={"site": ""}).json()["site"] is None

# ---------- Semana 8: jornada completa de ponta a ponta ----------

def test_jornada_completa_ponta_a_ponta():
    """Mesmo roteiro de docs/roteiro-de-testes.md: empresa → vagas → jovem → match → candidatura → contratação → cota."""
    # 1. Empresa se cadastra e preenche o organograma
    empresa = cadastrar_empresa()
    org = client.put("/empresas/me/organograma", headers=auth(empresa), json={"setores": [
        {"nome": "Loja", "funcionarios": 25, "exige_formacao": True},
        {"nome": "Diretoria", "funcionarios": 2, "exige_formacao": False},
    ]}).json()
    assert org["base_cota"] == 25

    # 2. Publica duas vagas diferentes; elas aparecem na lista pública (página inicial)
    criar_vaga(empresa, "Auxiliar de Logística", "separar mercadorias no estoque e conferir notas fiscais")
    vaga_adm = criar_vaga(empresa, "Assistente Administrativo", "organizar documentos e arquivos do escritório")
    assert len(client.get("/vagas/").json()) == 2

    # 3. Jovem se cadastra, sai e entra de novo pelo login
    cadastrar_jovem(email="joana@ex.com", descricao="Gosto de organizar documentos, arquivos e rotinas de escritório")
    jovem = client.post("/login", json={"email": "joana@ex.com", "senha": "senha123", "tipo": "jovem"}).json()["token"]

    # 4. Filtro inteligente recomenda primeiro a vaga administrativa
    recomendacoes = client.get("/jovens/me/recomendacoes", headers=auth(jovem)).json()
    assert recomendacoes[0]["id"] == vaga_adm

    # 5. Jovem vê o perfil público da empresa e se candidata
    perfil = client.get(f"/empresas/{recomendacoes[0]['empresa_id']}/perfil").json()
    assert len(perfil["vagas_abertas"]) == 2
    assert client.post(f"/vagas/{vaga_adm}/candidaturas", headers=auth(jovem)).status_code == 201

    # 6. Empresa recebe a candidatura e contrata
    recebida = client.get("/empresas/me/candidaturas", headers=auth(empresa)).json()[0]
    assert recebida["candidato"]["email"] == "joana@ex.com" and recebida["status"] == "pendente"
    client.patch(f"/candidaturas/{recebida['id']}", json={"status": "contratado"}, headers=auth(empresa))

    # 7. Cota: 25 × 5% = 1,25 → 2 aprendizes; 1 contratado, falta 1
    cota = client.get("/empresas/me/cota", headers=auth(empresa)).json()
    assert (cota["cota_minima"], cota["contratados"], cota["faltam_para_cota_minima"]) == (2, 1, 1)

    # 8. Jovem vê que foi contratado
    assert client.get("/jovens/me/candidaturas", headers=auth(jovem)).json()[0]["status"] == "contratado"

# ---------- Semana 9: casos-limite encontrados nos testes de integração ----------

def test_senha_longa_nao_derruba_cadastro_nem_login():
    longa = "á" * 40  # 80 bytes: acima do limite do bcrypt
    res = client.post("/jovens/", json={
        "nome": "Ana", "email": "ana@ex.com", "senha": longa, "descricao": "x",
        "aceitou_lgpd": True, "aceitou_lei_aprendizagem": True, "data_nascimento": nascido_ha(20),
    })
    assert res.status_code == 422
    cadastrar_jovem()
    assert client.post("/login", json={"email": "ana@ex.com", "senha": longa, "tipo": "jovem"}).status_code == 401

def test_sessao_de_usuario_apagado_pede_novo_login():
    token = cadastrar_jovem()
    db = TestingSession()
    db.query(models.JovemAprendiz).delete()
    db.commit()
    db.close()
    res = client.get("/jovens/me", headers=auth(token))
    assert res.status_code == 401  # o frontend desloga e volta para a página inicial

# ---------- Semana 10: validações de negócio e LGPD / ECA Digital ----------

def jovem_payload(**mudancas):
    base = {"nome": "Bia Santos", "email": "bia@ex.com", "senha": "senha123", "descricao": "organizada",
            "aceitou_lgpd": True, "aceitou_lei_aprendizagem": True, "data_nascimento": nascido_ha(20)}
    return {**base, **mudancas}

def test_idade_minima_e_maxima_do_aprendiz():
    menor_de_14 = client.post("/jovens/", json=jovem_payload(data_nascimento=nascido_ha(14, dias_a_mais=1)))
    assert menor_de_14.status_code == 400 and "14 anos" in menor_de_14.json()["detail"]
    com_25 = client.post("/jovens/", json=jovem_payload(data_nascimento=nascido_ha(25)))
    assert com_25.status_code == 400 and "24 anos" in com_25.json()["detail"]
    futuro = client.post("/jovens/", json=jovem_payload(data_nascimento="2999-01-01"))
    assert futuro.status_code == 400
    assert client.post("/jovens/", json=jovem_payload(data_nascimento=nascido_ha(24))).status_code == 201

def test_pessoa_com_deficiencia_nao_tem_idade_maxima():
    res = client.post("/jovens/", json=jovem_payload(data_nascimento=nascido_ha(30), pcd=True))
    assert res.status_code == 201

def test_menor_de_idade_precisa_de_responsavel():
    sem = client.post("/jovens/", json=jovem_payload(data_nascimento=nascido_ha(15)))
    assert sem.status_code == 400 and "responsável" in sem.json()["detail"]
    sem_aceite = client.post("/jovens/", json=jovem_payload(
        data_nascimento=nascido_ha(15), responsavel_nome="Maria Santos", responsavel_email="maria@ex.com"))
    assert sem_aceite.status_code == 400
    ok = client.post("/jovens/", json=jovem_payload(
        data_nascimento=nascido_ha(15), responsavel_nome="Maria Santos", responsavel_email="MARIA@ex.com", aceite_responsavel=True))
    assert ok.status_code == 201
    perfil = client.get("/jovens/me", headers=auth(ok.json()["token"])).json()
    assert (perfil["idade"], perfil["responsavel_email"]) == (15, "maria@ex.com")

def test_maior_de_idade_nao_guarda_dados_de_responsavel():
    res = client.post("/jovens/", json=jovem_payload(responsavel_nome="Fulano", responsavel_email="f@ex.com", aceite_responsavel=True))
    perfil = client.get("/jovens/me", headers=auth(res.json()["token"])).json()
    assert perfil["responsavel_nome"] is None and perfil["responsavel_email"] is None

def test_empresa_nao_ve_dados_sensiveis_do_candidato():
    empresa = cadastrar_empresa()
    vaga = criar_vaga(empresa)
    jovem = client.post("/jovens/", json=jovem_payload(
        data_nascimento=nascido_ha(16), pcd=True, descricao="gosto de organizar documentos e rotinas administrativas",
        responsavel_nome="Maria Santos", responsavel_email="maria@ex.com", aceite_responsavel=True)).json()["token"]

    # Antes da candidatura: só primeiro nome e descrição
    compat = client.get("/empresas/me/candidatos", headers=auth(empresa)).json()[0]
    assert compat["candidato_nome"] == "Bia" and compat["candidato_email"] is None and compat["contato_liberado"] is False

    # Depois da candidatura: contato liberado, mas sem nascimento, PcD ou responsável
    client.post(f"/vagas/{vaga}/candidaturas", headers=auth(jovem))
    compat = client.get("/empresas/me/candidatos", headers=auth(empresa)).json()[0]
    assert compat["candidato_nome"] == "Bia Santos" and compat["candidato_email"] == "bia@ex.com"
    candidato = client.get("/empresas/me/candidaturas", headers=auth(empresa)).json()[0]["candidato"]
    assert candidato["idade"] == 16
    for sensivel in ("data_nascimento", "pcd", "responsavel_nome", "responsavel_email"):
        assert sensivel not in candidato

def test_empresas_dispensadas_da_cota():
    for porte in ("me", "epp", "esfl"):
        token = cadastrar_empresa(email=f"{porte}@ex.com", porte=porte, total_funcionarios=40)
        cota = client.get("/empresas/me/cota", headers=auth(token)).json()
        assert cota["obrigatoria"] is False and cota["cota_minima"] == 0 and cota["motivo"]
    normal = client.get("/empresas/me/cota", headers=auth(cadastrar_empresa(total_funcionarios=40))).json()
    assert normal["obrigatoria"] is True and (normal["cota_minima"], normal["cota_maxima"]) == (2, 6)
    assert client.post("/empresas/", json={"nome": "X Ltda", "email": "x@ex.com", "senha": "senha123", "porte": "grande"}).status_code == 422

def test_excluir_conta_do_jovem():
    empresa = cadastrar_empresa()
    vaga = criar_vaga(empresa)
    jovem = cadastrar_jovem()
    client.post("/jovens/me/curriculo", files={"arquivo": ("cv.pdf", b"%PDF-1.4", "application/pdf")}, headers=auth(jovem))
    client.post(f"/vagas/{vaga}/candidaturas", headers=auth(jovem))

    assert client.delete("/jovens/me", headers=auth(jovem)).status_code == 200
    assert client.get("/jovens/me", headers=auth(jovem)).status_code == 401
    assert client.get("/empresas/me/candidaturas", headers=auth(empresa)).json() == []
    assert client.post("/login", json={"email": "ana@ex.com", "senha": "senha123", "tipo": "jovem"}).status_code == 401

def test_excluir_conta_da_empresa():
    empresa = cadastrar_empresa()
    vaga = criar_vaga(empresa)
    client.put("/empresas/me/organograma", headers=auth(empresa), json={"setores": [{"nome": "Loja", "funcionarios": 10}]})
    jovem = cadastrar_jovem()
    client.post(f"/vagas/{vaga}/candidaturas", headers=auth(jovem))

    assert client.delete("/empresas/me", headers=auth(empresa)).status_code == 200
    assert client.get("/vagas/").json() == []
    assert client.get("/jovens/me/candidaturas", headers=auth(jovem)).json() == []

# ---------- Semana 11: arquivos guardados no banco ----------

def test_arquivos_ficam_no_banco_e_saem_com_a_conta():
    jovem = cadastrar_jovem()
    url = client.post("/jovens/me/curriculo", files={"arquivo": ("cv.pdf", b"%PDF-1.4 v1", "application/pdf")}, headers=auth(jovem)).json()["curriculo_url"]
    db = TestingSession()
    assert db.query(models.Arquivo).count() == 1
    # Trocar o currículo apaga o antigo
    nova = client.post("/jovens/me/curriculo", files={"arquivo": ("cv.pdf", b"%PDF-1.4 v2", "application/pdf")}, headers=auth(jovem)).json()["curriculo_url"]
    assert db.query(models.Arquivo).count() == 1 and client.get(url, headers=auth(jovem)).status_code == 404
    assert client.get(nova, headers=auth(jovem)).content == b"%PDF-1.4 v2"
    client.delete("/jovens/me", headers=auth(jovem))
    assert db.query(models.Arquivo).count() == 0
    db.close()

def test_video_acima_de_20mb_e_recusado():
    jovem = cadastrar_jovem()
    grande = b"0" * (20 * 1024 * 1024 + 1)
    res = client.post("/jovens/me/video", files={"arquivo": ("v.mp4", grande, "video/mp4")}, headers=auth(jovem))
    assert res.status_code == 400 and "20 MB" in res.json()["detail"]
