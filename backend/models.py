from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text, Date, DateTime, LargeBinary, UniqueConstraint, func
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class Empresa(Base):
    __tablename__ = "empresas"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, index=True, nullable=False)
    cnpj = Column(String(14), unique=True, nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    senha_hash = Column(String, nullable=False)
    total_funcionarios = Column(Integer, nullable=True)
    descricao = Column(Text, nullable=True)
    cidade = Column(String, nullable=True)
    area_atuacao = Column(String, nullable=True)
    site = Column(String, nullable=True)
    porte = Column(String, default="demais", nullable=False)  # me, epp, esfl (sem fins lucrativos) ou demais
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    vagas = relationship("Vaga", back_populates="empresa", order_by="Vaga.id.desc()")  # mais recentes primeiro
    setores = relationship("Setor", back_populates="empresa", cascade="all, delete-orphan", order_by="Setor.id")

class JovemAprendiz(Base):
    __tablename__ = "jovens_aprendizes"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    senha_hash = Column(String, nullable=False)
    data_nascimento = Column(Date, nullable=True)
    cidade = Column(String, nullable=True)
    descricao = Column(Text)
    curriculo_url = Column(String, nullable=True)
    video_url = Column(String, nullable=True)
    aceitou_lgpd = Column(Boolean, default=False, nullable=False)
    aceitou_lei_aprendizagem = Column(Boolean, default=False, nullable=False)
    pcd = Column(Boolean, default=False, nullable=False)  # dado sensível: nunca enviado às empresas
    responsavel_nome = Column(String, nullable=True)       # obrigatório para menores de 18 anos
    responsavel_email = Column(String, nullable=True)
    aceite_responsavel = Column(Boolean, default=False, nullable=False)
    aceite_em = Column(DateTime(timezone=True), server_default=func.now())  # registro do consentimento (LGPD)
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

class Setor(Base):
    """Linha do organograma: um setor da empresa e quantos funcionários tem."""
    __tablename__ = "setores"
    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False)
    nome = Column(String, nullable=False)
    funcionarios = Column(Integer, nullable=False)
    exige_formacao = Column(Boolean, default=True, nullable=False)
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    empresa = relationship("Empresa", back_populates="setores")

class Arquivo(Base):
    """Currículo ou vídeo enviado pelo jovem, guardado no próprio banco
    (o disco do servidor no Render é apagado a cada reinício)."""
    __tablename__ = "arquivos"
    nome = Column(String, primary_key=True)  # <32 hex>.<extensão>, parte da URL /arquivos/<nome>
    jovem_id = Column(Integer, ForeignKey("jovens_aprendizes.id", ondelete="CASCADE"), nullable=False, index=True)
    content_type = Column(String, nullable=False)
    tamanho = Column(Integer, nullable=False)
    conteudo = Column(LargeBinary, nullable=False)
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
