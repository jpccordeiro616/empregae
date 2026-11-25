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
    descricao           TEXT,              -- apresentação exibida aos jovens
    cidade              VARCHAR,
    area_atuacao        VARCHAR,
    site                VARCHAR,
    porte               VARCHAR NOT NULL DEFAULT 'demais',  -- me, epp, esfl ou demais
    criado_em           TIMESTAMPTZ DEFAULT now()
);

-- Bancos criados antes desses campos (perfil público da empresa) recebem as colunas aqui.
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS descricao    TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS cidade       VARCHAR;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS area_atuacao VARCHAR;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS site         VARCHAR;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS porte        VARCHAR NOT NULL DEFAULT 'demais';

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
    pcd                       BOOLEAN NOT NULL DEFAULT FALSE,  -- dado sensível (LGPD art. 5º, II)
    responsavel_nome          VARCHAR,                          -- menores de 18 anos
    responsavel_email         VARCHAR,
    aceite_responsavel        BOOLEAN NOT NULL DEFAULT FALSE,
    aceite_em                 TIMESTAMPTZ DEFAULT now(),        -- quando os termos foram aceitos
    criado_em                 TIMESTAMPTZ DEFAULT now()
);

-- Semana 10 (validações de negócio e LGPD/ECA Digital) em bancos já existentes.
ALTER TABLE jovens_aprendizes ADD COLUMN IF NOT EXISTS pcd                BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE jovens_aprendizes ADD COLUMN IF NOT EXISTS responsavel_nome   VARCHAR;
ALTER TABLE jovens_aprendizes ADD COLUMN IF NOT EXISTS responsavel_email  VARCHAR;
ALTER TABLE jovens_aprendizes ADD COLUMN IF NOT EXISTS aceite_responsavel BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE jovens_aprendizes ADD COLUMN IF NOT EXISTS aceite_em          TIMESTAMPTZ DEFAULT now();

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

-- Organograma: setores da empresa. A cota é calculada sobre os funcionários
-- dos setores cujas funções exigem formação profissional (art. 429 da CLT).
CREATE TABLE IF NOT EXISTS setores (
    id              SERIAL PRIMARY KEY,
    empresa_id      INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nome            VARCHAR NOT NULL,
    funcionarios    INTEGER NOT NULL CHECK (funcionarios >= 0),
    exige_formacao  BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMPTZ DEFAULT now()
);

-- Currículos e vídeos (Semana 11): ficam no banco porque o disco do Render é temporário.
CREATE TABLE IF NOT EXISTS arquivos (
    nome          VARCHAR PRIMARY KEY,   -- <32 hex>.<extensão>, usado na URL /arquivos/<nome>
    jovem_id      INTEGER NOT NULL REFERENCES jovens_aprendizes(id) ON DELETE CASCADE,
    content_type  VARCHAR NOT NULL,
    tamanho       INTEGER NOT NULL,
    conteudo      BYTEA NOT NULL,
    criado_em     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_empresas_nome ON empresas (nome);
CREATE INDEX IF NOT EXISTS idx_jovens_nome   ON jovens_aprendizes (nome);
CREATE INDEX IF NOT EXISTS idx_vagas_titulo  ON vagas (titulo);
CREATE INDEX IF NOT EXISTS idx_vagas_empresa ON vagas (empresa_id);
CREATE INDEX IF NOT EXISTS idx_setores_empresa ON setores (empresa_id);
CREATE INDEX IF NOT EXISTS idx_arquivos_jovem ON arquivos (jovem_id);

-- Bloqueia o acesso público pela API automática do Supabase.
-- A API do Empregae conecta como dono das tabelas e não é afetada.
ALTER TABLE empresas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE jovens_aprendizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vagas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidaturas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE setores           ENABLE ROW LEVEL SECURITY;
ALTER TABLE arquivos          ENABLE ROW LEVEL SECURITY;
