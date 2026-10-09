from pathlib import Path
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.orm import Session
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import models
from database import engine, get_db
from matcher import calcular_compatibilidade

models.Base.metadata.create_all(bind=engine)

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

class JovemCriar(BaseModel):
    nome: str
    email: str
    senha: str
    descricao: str
    aceitou_lgpd: bool
    aceitou_lei_aprendizagem: bool

class EmpresaCriar(BaseModel):
    nome: str
    email: str
    senha: str

class VagaCriar(BaseModel):
    titulo: str
    descricao: str
    empresa_id: int

@app.post("/jovens/")
def criar_jovem(jovem: JovemCriar, db: Session = Depends(get_db)):
    if not jovem.aceitou_lgpd or not jovem.aceitou_lei_aprendizagem:
         raise HTTPException(status_code=400, detail="É necessário aceitar os termos da LGPD e da Lei da Aprendizagem.")

    db_jovem = models.JovemAprendiz(**jovem.model_dump())
    db.add(db_jovem)
    db.commit()
    db.refresh(db_jovem)
    return {"mensagem": "Jovem aprendiz cadastrado com sucesso!", "id": db_jovem.id}

@app.post("/empresas/")
def criar_empresa(empresa: EmpresaCriar, db: Session = Depends(get_db)):
    db_empresa = models.Empresa(**empresa.model_dump())
    db.add(db_empresa)
    db.commit()
    db.refresh(db_empresa)
    return {"mensagem": "Empresa cadastrada com sucesso!", "id": db_empresa.id}

@app.post("/vagas/")
def criar_vaga(vaga: VagaCriar, db: Session = Depends(get_db)):
    db_vaga = models.Vaga(**vaga.model_dump())
    db.add(db_vaga)
    db.commit()
    db.refresh(db_vaga)
    return {"mensagem": "Vaga cadastrada com sucesso!", "id": db_vaga.id}

@app.get("/vagas/recomendadas/{jovem_id}")
def vagas_recomendadas(jovem_id: int, db: Session = Depends(get_db)):
    jovem = db.query(models.JovemAprendiz).filter(models.JovemAprendiz.id == jovem_id).first()
    if not jovem:
        raise HTTPException(status_code=404, detail="Jovem aprendiz não encontrado")

    vagas = db.query(models.Vaga).all()
    resultados = []
    for vaga in vagas:
        pontuacao = calcular_compatibilidade(jovem.descricao, vaga.descricao)
        resultados.append({
            "vaga_id": vaga.id,
            "titulo": vaga.titulo,
            "descricao": vaga.descricao,
            "empresa_nome": vaga.empresa.nome if vaga.empresa else "Desconhecida",
            "compatibilidade": pontuacao
        })

    resultados.sort(key=lambda x: x["compatibilidade"], reverse=True)
    return resultados

@app.get("/empresas/{empresa_id}/candidatos")
def candidatos_da_empresa(empresa_id: int, db: Session = Depends(get_db)):
    vagas = db.query(models.Vaga).filter(models.Vaga.empresa_id == empresa_id).all()
    jovens = db.query(models.JovemAprendiz).all()

    candidatos = []
    for vaga in vagas:
        for jovem in jovens:
            pontuacao = calcular_compatibilidade(jovem.descricao, vaga.descricao)
            if pontuacao > 0:
                 candidatos.append({
                     "vaga_titulo": vaga.titulo,
                     "candidato_nome": jovem.nome,
                     "candidato_email": jovem.email,
                     "candidato_descricao": jovem.descricao,
                     "compatibilidade": pontuacao
                 })
    candidatos.sort(key=lambda x: x["compatibilidade"], reverse=True)
    return candidatos

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
