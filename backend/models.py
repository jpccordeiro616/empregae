from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text, Date, DateTime, UniqueConstraint, func
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class Company(Base):
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    cnpj = Column(String(14), unique=True, nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    total_employees = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    vacancies = relationship("Vacancy", back_populates="company")

class Apprentice(Base):
    __tablename__ = "apprentices"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    birth_date = Column(Date, nullable=True)
    city = Column(String, nullable=True)
    description = Column(Text)
    video_url = Column(String, nullable=True)
    accepted_lgpd = Column(Boolean, default=False, nullable=False)
    accepted_aprendizagem = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    applications = relationship("Application", back_populates="apprentice")

class Vacancy(Base):
    __tablename__ = "vacancies"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    description = Column(Text)
    is_open = Column(Boolean, default=True, nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    company = relationship("Company", back_populates="vacancies")
    applications = relationship("Application", back_populates="vacancy")

class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (UniqueConstraint("apprentice_id", "vacancy_id"),)
    id = Column(Integer, primary_key=True, index=True)
    apprentice_id = Column(Integer, ForeignKey("apprentices.id"), nullable=False)
    vacancy_id = Column(Integer, ForeignKey("vacancies.id"), nullable=False)
    status = Column(String, default="pendente", nullable=False)  # pendente, em_analise, contratado, recusado
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    apprentice = relationship("Apprentice", back_populates="applications")
    vacancy = relationship("Vacancy", back_populates="applications")
