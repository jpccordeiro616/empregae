from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text, Date, DateTime, UniqueConstraint, func
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class Empresa(Base):
    __tablename__ = "empresas"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, index=True, nullable=False)
    cnpj = Column(String(14), unique=True, nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    senha = Column(String, nullable=False)
    total_funcionarios = Column(Integer, nullable=True)
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    vagas = relationship("Vaga", back_populates="empresa")

class JovemAprendiz(Base):
    __tablename__ = "jovens_aprendizes"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    senha = Column(String, nullable=False)
    data_nascimento = Column(Date, nullable=True)
    cidade = Column(String, nullable=True)
    descricao = Column(Text)
    video_url = Column(String, nullable=True)
    aceitou_lgpd = Column(Boolean, default=False, nullable=False)
    aceitou_lei_aprendizagem = Column(Boolean, default=False, nullable=False)
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    candidaturas = relationship("Candidatura", back_populates="jovem")

class Vaga(Base):
    __tablename__ = "vagas"
    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String, index=True, nullable=False)
    descricao = Column(Text)
    aberta = Column(Boolean, default=True, nullable=False)
    empresa_id = Column(Integer, ForeignKey("empresas.id"), nullable=False)
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    empresa = relationship("Empresa", back_populates="vagas")
    candidaturas = relationship("Candidatura", back_populates="vaga")

class Candidatura(Base):
    __tablename__ = "candidaturas"
    __table_args__ = (UniqueConstraint("jovem_id", "vaga_id"),)
    id = Column(Integer, primary_key=True, index=True)
    jovem_id = Column(Integer, ForeignKey("jovens_aprendizes.id"), nullable=False)
    vaga_id = Column(Integer, ForeignKey("vagas.id"), nullable=False)
    status = Column(String, default="pendente", nullable=False)  # pendente, em_analise, contratado, recusado
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    jovem = relationship("JovemAprendiz", back_populates="candidaturas")
    vaga = relationship("Vaga", back_populates="candidaturas")
