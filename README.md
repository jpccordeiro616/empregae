# Empregae

Plataforma que conecta **jovens aprendizes** a **empresas que precisam cumprir a cota da Lei da Aprendizagem** (Lei nº 10.097/2000), com um filtro inteligente que recomenda vagas e candidatos.

## Estrutura

```
empregae/
├── backend/            API em Python (FastAPI + SQLAlchemy)
│   ├── main.py         rotas da API e servidor do frontend
│   ├── database.py     conexão com o banco (lê DATABASE_URL do .env)
│   ├── auth.py         senhas (bcrypt) e login com token JWT
│   ├── schema.sql      criação das tabelas em SQL (rodar no Supabase)
│   ├── models.py       tabelas: empresas, jovens_aprendizes, vagas, candidaturas
│   ├── matcher.py      filtro inteligente (TF-IDF + similaridade de cosseno)
│   ├── tests/          testes automatizados (pytest)
│   └── .env.example    modelo das variáveis de ambiente
├── frontend/           HTML, CSS e JavaScript puro
└── docs/
    └── requisitos.md   levantamento de requisitos e regras de negócio
```

## Como rodar localmente

Pré-requisitos: Python 3.12+ e acesso ao projeto no Supabase (banco PostgreSQL).

```bash
# 1. Ambiente Python
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 2. Banco de dados
cp .env.example .env
# Edite o .env e cole em DATABASE_URL a connection string do Supabase:
# Connect → Direct → Session pooler (troque [YOUR-PASSWORD] pela senha, sem colchetes)
# e em JWT_SECRET uma chave aleatória: python -c "import secrets; print(secrets.token_urlsafe(48))"

# 3. Criar as tabelas (só na primeira vez)
# Supabase → SQL Editor → cole o conteúdo de backend/schema.sql → Run

# 4. Subir a API
uvicorn main:app --reload
```

Acesse:
- Aplicação: http://localhost:8000
- Documentação da API: http://localhost:8000/docs
- Saúde da API/banco: http://localhost:8000/saude

## Telas

| Tela | O que tem |
|---|---|
| Página inicial | Apresentação, como funciona, público, resumo da Lei da Aprendizagem |
| Entrar | Login de jovem ou empresa (a sessão fica salva no navegador) |
| Cadastro de jovem / empresa | Formulários com validação e mensagens de erro |
| Painel do jovem | Vagas recomendadas e busca, candidaturas com status, mensagens (prévia), perfil com currículo e vídeo |
| Painel da empresa | Nova vaga, cota e candidatos compatíveis (em evolução na Semana 7) |

## Testes

```bash
cd backend
pytest
```

Os testes usam um banco SQLite em memória e não alteram o banco PostgreSQL.

## Cronograma

| Mês | Semanas | Foco |
|---|---|---|
| 1 | 1–4 | Requisitos, banco de dados e backend |
| 2 | 5–8 | Frontend e integração |
| 3 | 9–12 | Testes, segurança (LGPD), deploy no Render e documentação |
