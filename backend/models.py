from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class Company(Base):
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    vacancies = relationship("Vacancy", back_populates="company")

class Apprentice(Base):
    __tablename__ = "apprentices"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    description = Column(Text)
    video_url = Column(String, nullable=True)
    accepted_lgpd = Column(Boolean, default=False)
    accepted_aprendizagem = Column(Boolean, default=False)

class Vacancy(Base):
    __tablename__ = "vacancies"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(Text)
    company_id = Column(Integer, ForeignKey("companies.id"))
    company = relationship("Company", back_populates="vacancies")
