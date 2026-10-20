-- Empregae — criação das tabelas (PostgreSQL / Supabase)
-- Como usar: Supabase → SQL Editor → cole este arquivo → Run.
-- Pode ser executado mais de uma vez: só cria o que ainda não existe.

CREATE TABLE IF NOT EXISTS empresas (
    id                  SERIAL PRIMARY KEY,
    nome                VARCHAR NOT NULL,
    cnpj                VARCHAR(14) UNIQUE,
    email               VARCHAR NOT NULL UNIQUE,
    senha_hash          VARCHAR NOT NULL,  -- bcrypt, nunca a senha pura
    total_funcionarios  INTEGER CHECK (total_funcionarios >= 0),
    criado_em           TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jovens_aprendizes (
    id                        SERIAL PRIMARY KEY,
    nome                      VARCHAR NOT NULL,
    email                     VARCHAR NOT NULL UNIQUE,
    senha_hash                VARCHAR NOT NULL,  -- bcrypt, nunca a senha pura
    data_nascimento           DATE,
    cidade                    VARCHAR,
    descricao                 TEXT,
    curriculo_url             VARCHAR,
    video_url                 VARCHAR,
    aceitou_lgpd              BOOLEAN NOT NULL DEFAULT FALSE,
    aceitou_lei_aprendizagem  BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em                 TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vagas (
    id          SERIAL PRIMARY KEY,
    titulo      VARCHAR NOT NULL,
    descricao   TEXT,
    aberta      BOOLEAN NOT NULL DEFAULT TRUE,
    empresa_id  INTEGER NOT NULL REFERENCES empresas(id),
    criado_em   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS candidaturas (
    id         SERIAL PRIMARY KEY,
    jovem_id   INTEGER NOT NULL REFERENCES jovens_aprendizes(id),
    vaga_id    INTEGER NOT NULL REFERENCES vagas(id),
    status     VARCHAR NOT NULL DEFAULT 'pendente'
               CHECK (status IN ('pendente', 'em_analise', 'contratado', 'recusado')),
    criado_em  TIMESTAMPTZ DEFAULT now(),
    UNIQUE (jovem_id, vaga_id)  -- RN07: uma candidatura por vaga
);

CREATE INDEX IF NOT EXISTS idx_empresas_nome ON empresas (nome);
CREATE INDEX IF NOT EXISTS idx_jovens_nome   ON jovens_aprendizes (nome);
CREATE INDEX IF NOT EXISTS idx_vagas_titulo  ON vagas (titulo);
CREATE INDEX IF NOT EXISTS idx_vagas_empresa ON vagas (empresa_id);

-- Bloqueia o acesso público pela API automática do Supabase.
-- A API do Empregae conecta como dono das tabelas e não é afetada.
ALTER TABLE empresas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE jovens_aprendizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vagas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidaturas      ENABLE ROW LEVEL SECURITY;
