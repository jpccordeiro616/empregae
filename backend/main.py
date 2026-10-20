import re
import uuid
from datetime import date
from pathlib import Path
from typing import Annotated, Literal
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text, or_
from sqlalchemy.orm import Session
from pydantic import AfterValidator, BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware
import models
from database import engine, get_db
from matcher import calcular_compatibilidades
from auth import gerar_hash, senha_confere, criar_token, usuario_logado, jovem_logado, empresa_logada

# As tabelas são criadas pelo schema.sql (rodar no SQL Editor do Supabase).

BASE_DIR = Path(__file__).resolve().parent
UPLOADS_DIR = BASE_DIR / "uploads"
FRONTEND_DIR = BASE_DIR.parent / "frontend"

app = FastAPI(title="Empregae API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/saude")
def saude(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok", "banco": engine.dialect.name}

# ---------- Esquemas de entrada ----------

def _normalizar_email(email: str) -> str:
    email = email.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise ValueError("E-mail inválido.")
    return email

def _normalizar_cnpj(cnpj: str | None) -> str | None:
    if cnpj is None:
        return None
    digitos = re.sub(r"\D", "", cnpj)
    if len(digitos) != 14:
        raise ValueError("CNPJ deve ter 14 dígitos.")
    return digitos

Email = Annotated[str, AfterValidator(_normalizar_email)]
Cnpj = Annotated[str | None, AfterValidator(_normalizar_cnpj)]

class JovemCriar(BaseModel):
    nome: str = Field(min_length=2)
    email: Email
    senha: str = Field(min_length=6)
    descricao: str
    data_nascimento: date | None = None
    cidade: str | None = None
    aceitou_lgpd: bool
    aceitou_lei_aprendizagem: bool

class JovemAtualizar(BaseModel):
    nome: str | None = Field(default=None, min_length=2)
    descricao: str | None = None
    data_nascimento: date | None = None
    cidade: str | None = None

class EmpresaCriar(BaseModel):
    nome: str = Field(min_length=2)
    email: Email
    senha: str = Field(min_length=6)
    cnpj: Cnpj = None
    total_funcionarios: int | None = Field(default=None, ge=0)

class EmpresaAtualizar(BaseModel):
    nome: str | None = Field(default=None, min_length=2)
    cnpj: Cnpj = None
    total_funcionarios: int | None = Field(default=None, ge=0)

class Login(BaseModel):
    email: str
    senha: str
    tipo: Literal["jovem", "empresa"]

class VagaCriar(BaseModel):
    titulo: str = Field(min_length=3)
    descricao: str = Field(min_length=10)

class VagaAtualizar(BaseModel):
    titulo: str | None = Field(default=None, min_length=3)
    descricao: str | None = Field(default=None, min_length=10)
    aberta: bool | None = None

class CandidaturaAtualizar(BaseModel):
    status: Literal["pendente", "em_analise", "contratado", "recusado"]

# ---------- Formato das respostas ----------

def perfil_jovem(j: models.JovemAprendiz) -> dict:
    return {
        "id": j.id, "nome": j.nome, "email": j.email, "data_nascimento": j.data_nascimento,
        "cidade": j.cidade, "descricao": j.descricao, "curriculo_url": j.curriculo_url,
        "video_url": j.video_url,
    }

def perfil_empresa(e: models.Empresa) -> dict:
    return {"id": e.id, "nome": e.nome, "email": e.email, "cnpj": e.cnpj, "total_funcionarios": e.total_funcionarios}

def dados_vaga(v: models.Vaga) -> dict:
    return {
        "id": v.id, "titulo": v.titulo, "descricao": v.descricao, "aberta": v.aberta,
        "empresa_id": v.empresa_id, "empresa_nome": v.empresa.nome,
    }

def texto_vaga(v: models.Vaga) -> str:
    return f"{v.titulo} {v.descricao or ''}"

# ---------- Semana 3: cadastro, login e perfis ----------

def _email_em_uso(db: Session, modelo, email: str) -> bool:
    return db.query(modelo).filter(modelo.email == email).first() is not None

@app.post("/jovens/", status_code=201)
def criar_jovem(dados: JovemCriar, db: Session = Depends(get_db)):
    if not dados.aceitou_lgpd or not dados.aceitou_lei_aprendizagem:
        raise HTTPException(status_code=400, detail="É necessário aceitar os termos da LGPD e da Lei da Aprendizagem.")
    if _email_em_uso(db, models.JovemAprendiz, dados.email):
        raise HTTPException(status_code=409, detail="Este e-mail já está cadastrado.")

    jovem = models.JovemAprendiz(**dados.model_dump(exclude={"senha"}), senha_hash=gerar_hash(dados.senha))
    db.add(jovem)
    db.commit()
    db.refresh(jovem)
    return {"mensagem": "Jovem aprendiz cadastrado com sucesso!", "id": jovem.id, "token": criar_token(jovem.id, "jovem")}

@app.post("/empresas/", status_code=201)
def criar_empresa(dados: EmpresaCriar, db: Session = Depends(get_db)):
    if _email_em_uso(db, models.Empresa, dados.email):
        raise HTTPException(status_code=409, detail="Este e-mail já está cadastrado.")
    if dados.cnpj and db.query(models.Empresa).filter(models.Empresa.cnpj == dados.cnpj).first():
        raise HTTPException(status_code=409, detail="Este CNPJ já está cadastrado.")

    empresa = models.Empresa(**dados.model_dump(exclude={"senha"}), senha_hash=gerar_hash(dados.senha))
    db.add(empresa)
    db.commit()
    db.refresh(empresa)
    return {"mensagem": "Empresa cadastrada com sucesso!", "id": empresa.id, "token": criar_token(empresa.id, "empresa")}

@app.post("/login")
def login(dados: Login, db: Session = Depends(get_db)):
    modelo = models.JovemAprendiz if dados.tipo == "jovem" else models.Empresa
    usuario = db.query(modelo).filter(modelo.email == dados.email.strip().lower()).first()
    if not usuario or not senha_confere(dados.senha, usuario.senha_hash):
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos.")
    perfil = perfil_jovem(usuario) if dados.tipo == "jovem" else perfil_empresa(usuario)
    return {"token": criar_token(usuario.id, dados.tipo), "tipo": dados.tipo, "usuario": perfil}

@app.get("/jovens/me")
def ver_perfil_jovem(jovem: models.JovemAprendiz = Depends(jovem_logado)):
    return perfil_jovem(jovem)

@app.patch("/jovens/me")
def atualizar_perfil_jovem(dados: JovemAtualizar, jovem: models.JovemAprendiz = Depends(jovem_logado), db: Session = Depends(get_db)):
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(jovem, campo, valor)
    db.commit()
    return perfil_jovem(jovem)

@app.get("/empresas/me")
def ver_perfil_empresa(empresa: models.Empresa = Depends(empresa_logada)):
    return perfil_empresa(empresa)

@app.patch("/empresas/me")
def atualizar_perfil_empresa(dados: EmpresaAtualizar, empresa: models.Empresa = Depends(empresa_logada), db: Session = Depends(get_db)):
    novos = dados.model_dump(exclude_unset=True)
    if novos.get("cnpj") and db.query(models.Empresa).filter(models.Empresa.cnpj == novos["cnpj"], models.Empresa.id != empresa.id).first():
        raise HTTPException(status_code=409, detail="Este CNPJ já está cadastrado.")
    for campo, valor in novos.items():
        setattr(empresa, campo, valor)
    db.commit()
    return perfil_empresa(empresa)

# Currículo e vídeo ficam em backend/uploads/ por enquanto.
# shortcut: no deploy (Semana 11) trocar pelo Supabase Storage, pois o disco do Render é apagado a cada deploy.
TIPOS_ARQUIVO = {
    "curriculo": ({"application/pdf": ".pdf"}, 5 * 1024 * 1024),
    "video": ({"video/mp4": ".mp4", "video/webm": ".webm", "video/quicktime": ".mov"}, 50 * 1024 * 1024),
}

async def _salvar_arquivo(arquivo: UploadFile, tipo: str) -> str:
    formatos, tamanho_max = TIPOS_ARQUIVO[tipo]
    extensao = formatos.get(arquivo.content_type)
    if not extensao:
        raise HTTPException(status_code=400, detail=f"Formato não aceito. Envie: {', '.join(formatos.values())}.")
    conteudo = await arquivo.read(tamanho_max + 1)
    if len(conteudo) > tamanho_max:
        raise HTTPException(status_code=400, detail=f"Arquivo maior que {tamanho_max // (1024 * 1024)} MB.")

    UPLOADS_DIR.mkdir(exist_ok=True)
    nome = f"{uuid.uuid4().hex}{extensao}"
    (UPLOADS_DIR / nome).write_bytes(conteudo)
    return f"/arquivos/{nome}"

def _apagar_arquivo(url: str | None):
    if url:
        (UPLOADS_DIR / Path(url).name).unlink(missing_ok=True)

@app.post("/jovens/me/curriculo")
async def enviar_curriculo(arquivo: UploadFile = File(...), jovem: models.JovemAprendiz = Depends(jovem_logado), db: Session = Depends(get_db)):
    url = await _salvar_arquivo(arquivo, "curriculo")
    _apagar_arquivo(jovem.curriculo_url)
    jovem.curriculo_url = url
    db.commit()
    return {"mensagem": "Currículo enviado com sucesso!", "curriculo_url": url}

@app.post("/jovens/me/video")
async def enviar_video(arquivo: UploadFile = File(...), jovem: models.JovemAprendiz = Depends(jovem_logado), db: Session = Depends(get_db)):
    url = await _salvar_arquivo(arquivo, "video")
    _apagar_arquivo(jovem.video_url)
    jovem.video_url = url
    db.commit()
    return {"mensagem": "Vídeo enviado com sucesso!", "video_url": url}

@app.get("/arquivos/{nome}")
def baixar_arquivo(nome: str, usuario: tuple[int, str] = Depends(usuario_logado), db: Session = Depends(get_db)):
    if not re.fullmatch(r"[0-9a-f]{32}\.(pdf|mp4|webm|mov)", nome):
        raise HTTPException(status_code=404, detail="Arquivo não encontrado.")
    url = f"/arquivos/{nome}"
    dono = db.query(models.JovemAprendiz).filter(or_(models.JovemAprendiz.curriculo_url == url, models.JovemAprendiz.video_url == url)).first()
    usuario_id, tipo = usuario
    # Empresas podem ver arquivos de qualquer candidato; um jovem só vê os próprios.
    if not dono or (tipo == "jovem" and dono.id != usuario_id) or not (UPLOADS_DIR / nome).exists():
        raise HTTPException(status_code=404, detail="Arquivo não encontrado.")
    return FileResponse(UPLOADS_DIR / nome)

# ---------- Semana 4: vagas, candidaturas, cota e filtro inteligente ----------

@app.post("/vagas/", status_code=201)
def criar_vaga(dados: VagaCriar, empresa: models.Empresa = Depends(empresa_logada), db: Session = Depends(get_db)):
    vaga = models.Vaga(**dados.model_dump(), empresa_id=empresa.id)
    db.add(vaga)
    db.commit()
    db.refresh(vaga)
    return {"mensagem": "Vaga cadastrada com sucesso!", "id": vaga.id}

@app.get("/vagas/")
def listar_vagas(busca: str | None = None, db: Session = Depends(get_db)):
    consulta = db.query(models.Vaga).join(models.Empresa).filter(models.Vaga.aberta.is_(True))
    if busca:
        termo = f"%{busca.strip()}%"
        consulta = consulta.filter(or_(models.Vaga.titulo.ilike(termo), models.Vaga.descricao.ilike(termo), models.Empresa.nome.ilike(termo)))
    return [dados_vaga(v) for v in consulta.order_by(models.Vaga.criado_em.desc()).all()]

def _vaga_da_empresa(vaga_id: int, empresa: models.Empresa, db: Session) -> models.Vaga:
    vaga = db.get(models.Vaga, vaga_id)
    if not vaga:
        raise HTTPException(status_code=404, detail="Vaga não encontrada.")
    if vaga.empresa_id != empresa.id:
        raise HTTPException(status_code=403, detail="Esta vaga pertence a outra empresa.")
    return vaga

@app.get("/vagas/{vaga_id}")
def ver_vaga(vaga_id: int, db: Session = Depends(get_db)):
    vaga = db.get(models.Vaga, vaga_id)
    if not vaga:
        raise HTTPException(status_code=404, detail="Vaga não encontrada.")
    return dados_vaga(vaga)

@app.patch("/vagas/{vaga_id}")
def atualizar_vaga(vaga_id: int, dados: VagaAtualizar, empresa: models.Empresa = Depends(empresa_logada), db: Session = Depends(get_db)):
    vaga = _vaga_da_empresa(vaga_id, empresa, db)
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(vaga, campo, valor)
    db.commit()
    return dados_vaga(vaga)

@app.get("/empresas/me/vagas")
def minhas_vagas(empresa: models.Empresa = Depends(empresa_logada)):
    return [{**dados_vaga(v), "total_candidaturas": len(v.candidaturas)} for v in empresa.vagas]

@app.post("/vagas/{vaga_id}/candidaturas", status_code=201)
def candidatar(vaga_id: int, jovem: models.JovemAprendiz = Depends(jovem_logado), db: Session = Depends(get_db)):
    vaga = db.get(models.Vaga, vaga_id)
    if not vaga:
        raise HTTPException(status_code=404, detail="Vaga não encontrada.")
    if not vaga.aberta:
        raise HTTPException(status_code=400, detail="Esta vaga está encerrada.")
    if db.query(models.Candidatura).filter_by(jovem_id=jovem.id, vaga_id=vaga.id).first():
        raise HTTPException(status_code=409, detail="Você já se candidatou a esta vaga.")

    candidatura = models.Candidatura(jovem_id=jovem.id, vaga_id=vaga.id)
    db.add(candidatura)
    db.commit()
    return {"mensagem": "Candidatura enviada!", "id": candidatura.id}

@app.get("/jovens/me/candidaturas")
def minhas_candidaturas(jovem: models.JovemAprendiz = Depends(jovem_logado)):
    return [{"id": c.id, "status": c.status, "criado_em": c.criado_em, "vaga": dados_vaga(c.vaga)} for c in jovem.candidaturas]

@app.get("/empresas/me/candidaturas")
def candidaturas_recebidas(empresa: models.Empresa = Depends(empresa_logada)):
    resultado = []
    for vaga in empresa.vagas:
        notas = calcular_compatibilidades(texto_vaga(vaga), [c.jovem.descricao for c in vaga.candidaturas])
        for candidatura, nota in zip(vaga.candidaturas, notas):
            resultado.append({
                "id": candidatura.id, "status": candidatura.status, "criado_em": candidatura.criado_em,
                "vaga_id": vaga.id, "vaga_titulo": vaga.titulo,
                "candidato": perfil_jovem(candidatura.jovem), "compatibilidade": nota,
            })
    resultado.sort(key=lambda x: x["compatibilidade"], reverse=True)
    return resultado

@app.patch("/candidaturas/{candidatura_id}")
def atualizar_candidatura(candidatura_id: int, dados: CandidaturaAtualizar, empresa: models.Empresa = Depends(empresa_logada), db: Session = Depends(get_db)):
    candidatura = db.get(models.Candidatura, candidatura_id)
    if not candidatura or candidatura.vaga.empresa_id != empresa.id:
        raise HTTPException(status_code=404, detail="Candidatura não encontrada.")
    candidatura.status = dados.status
    db.commit()
    return {"mensagem": "Status atualizado.", "id": candidatura.id, "status": candidatura.status}

@app.get("/empresas/me/cota")
def cota_aprendizes(empresa: models.Empresa = Depends(empresa_logada), db: Session = Depends(get_db)):
    """RN01/RN02: mínimo de 5% (fração arredonda para cima) e máximo de 15%."""
    total = empresa.total_funcionarios or 0
    cota_minima = (total * 5 + 99) // 100
    cota_maxima = max(cota_minima, total * 15 // 100)
    contratados = (
        db.query(models.Candidatura).join(models.Vaga)
        .filter(models.Vaga.empresa_id == empresa.id, models.Candidatura.status == "contratado").count()
    )
    return {
        "total_funcionarios": empresa.total_funcionarios,
        "cota_minima": cota_minima,
        "cota_maxima": cota_maxima,
        "contratados": contratados,
        "faltam_para_cota_minima": max(0, cota_minima - contratados),
    }

@app.get("/jovens/me/recomendacoes")
def vagas_recomendadas(jovem: models.JovemAprendiz = Depends(jovem_logado), db: Session = Depends(get_db)):
    vagas = db.query(models.Vaga).filter(models.Vaga.aberta.is_(True)).all()
    notas = calcular_compatibilidades(jovem.descricao, [texto_vaga(v) for v in vagas])
    ja_candidatou = {c.vaga_id for c in jovem.candidaturas}
    resultados = [{**dados_vaga(v), "compatibilidade": n, "ja_candidatou": v.id in ja_candidatou} for v, n in zip(vagas, notas)]
    resultados.sort(key=lambda x: x["compatibilidade"], reverse=True)
    return resultados

@app.get("/empresas/me/candidatos")
def candidatos_compativeis(empresa: models.Empresa = Depends(empresa_logada), db: Session = Depends(get_db)):
    jovens = db.query(models.JovemAprendiz).all()
    candidatos = []
    for vaga in empresa.vagas:
        if not vaga.aberta:
            continue
        notas = calcular_compatibilidades(texto_vaga(vaga), [j.descricao for j in jovens])
        for jovem, nota in zip(jovens, notas):
            if nota > 0:
                candidatos.append({
                    "vaga_id": vaga.id,
                    "vaga_titulo": vaga.titulo,
                    "candidato_id": jovem.id,
                    "candidato_nome": jovem.nome,
                    "candidato_email": jovem.email,
                    "candidato_descricao": jovem.descricao,
                    "compatibilidade": nota,
                })
    candidatos.sort(key=lambda x: x["compatibilidade"], reverse=True)
    return candidatos

app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
