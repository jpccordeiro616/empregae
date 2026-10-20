import os
from datetime import datetime, timedelta, timezone
import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import models
from database import get_db

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("Defina JWT_SECRET no .env (veja .env.example).")

TOKEN_VALIDADE = timedelta(hours=24)
bearer = HTTPBearer(auto_error=False)

def gerar_hash(senha: str) -> str:
    return bcrypt.hashpw(senha.encode(), bcrypt.gensalt()).decode()

def senha_confere(senha: str, senha_hash: str) -> bool:
    return bcrypt.checkpw(senha.encode(), senha_hash.encode())

def criar_token(usuario_id: int, tipo: str) -> str:
    expira = datetime.now(timezone.utc) + TOKEN_VALIDADE
    return jwt.encode({"sub": str(usuario_id), "tipo": tipo, "exp": expira}, JWT_SECRET, algorithm="HS256")

def _ler_token(credenciais: HTTPAuthorizationCredentials | None) -> tuple[int, str]:
    if credenciais is None:
        raise HTTPException(status_code=401, detail="Faça login para continuar.")
    try:
        dados = jwt.decode(credenciais.credentials, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sessão expirada. Faça login novamente.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido.")
    return int(dados["sub"]), dados["tipo"]

def usuario_logado(credenciais: HTTPAuthorizationCredentials | None = Depends(bearer)) -> tuple[int, str]:
    return _ler_token(credenciais)

def jovem_logado(credenciais: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)) -> models.JovemAprendiz:
    usuario_id, tipo = _ler_token(credenciais)
    jovem = db.get(models.JovemAprendiz, usuario_id) if tipo == "jovem" else None
    if not jovem:
        raise HTTPException(status_code=403, detail="Acesso permitido apenas para jovens aprendizes.")
    return jovem

def empresa_logada(credenciais: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)) -> models.Empresa:
    usuario_id, tipo = _ler_token(credenciais)
    empresa = db.get(models.Empresa, usuario_id) if tipo == "empresa" else None
    if not empresa:
        raise HTTPException(status_code=403, detail="Acesso permitido apenas para empresas.")
    return empresa
