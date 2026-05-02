from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import models
from matcher import calculate_match_score

SQLALCHEMY_DATABASE_URL = "sqlite:///./empregae.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Empregae Prototype API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class ApprenticeCreate(BaseModel):
    name: str
    email: str
    password: str
    description: str
    accepted_lgpd: bool
    accepted_aprendizagem: bool

class CompanyCreate(BaseModel):
    name: str
    email: str
    password: str

class VacancyCreate(BaseModel):
    title: str
    description: str
    company_id: int

@app.post("/apprentices/")
def create_apprentice(apprentice: ApprenticeCreate, db: Session = Depends(get_db)):
    if not apprentice.accepted_lgpd or not apprentice.accepted_aprendizagem:
         raise HTTPException(status_code=400, detail="É necessário aceitar os termos da LGPD e da Lei da Aprendizagem.")
    
    db_apprentice = models.Apprentice(**apprentice.model_dump())
    db.add(db_apprentice)
    db.commit()
    db.refresh(db_apprentice)
    return {"message": "Jovem aprendiz cadastrado com sucesso!", "id": db_apprentice.id}

@app.post("/companies/")
def create_company(company: CompanyCreate, db: Session = Depends(get_db)):
    db_company = models.Company(**company.model_dump())
    db.add(db_company)
    db.commit()
    db.refresh(db_company)
    return {"message": "Empresa cadastrada com sucesso!", "id": db_company.id}

@app.post("/vacancies/")
def create_vacancy(vacancy: VacancyCreate, db: Session = Depends(get_db)):
    db_vacancy = models.Vacancy(**vacancy.model_dump())
    db.add(db_vacancy)
    db.commit()
    db.refresh(db_vacancy)
    return {"message": "Vaga cadastrada com sucesso!", "id": db_vacancy.id}

@app.get("/vacancies/match/{apprentice_id}")
def match_vacancies(apprentice_id: int, db: Session = Depends(get_db)):
    apprentice = db.query(models.Apprentice).filter(models.Apprentice.id == apprentice_id).first()
    if not apprentice:
        raise HTTPException(status_code=404, detail="Jovem aprendiz não encontrado")
    
    vacancies = db.query(models.Vacancy).all()
    results = []
    for vac in vacancies:
        score = calculate_match_score(apprentice.description, vac.description)
        results.append({
            "vacancy_id": vac.id,
            "title": vac.title,
            "description": vac.description,
            "company_name": vac.company.name if vac.company else "Desconhecida",
            "match_score": score
        })
    
    results.sort(key=lambda x: x["match_score"], reverse=True)
    return results

@app.get("/companies/{company_id}/candidates")
def get_candidates_for_company(company_id: int, db: Session = Depends(get_db)):
    vacancies = db.query(models.Vacancy).filter(models.Vacancy.company_id == company_id).all()
    apprentices = db.query(models.Apprentice).all()
    
    matches = []
    for vac in vacancies:
        for app in apprentices:
            score = calculate_match_score(app.description, vac.description)
            if score > 0:
                 matches.append({
                     "vacancy_title": vac.title,
                     "candidate_name": app.name,
                     "candidate_email": app.email,
                     "candidate_description": app.description,
                     "match_score": score
                 })
    matches.sort(key=lambda x: x["match_score"], reverse=True)
    return matches
