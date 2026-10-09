# Levantamento de Requisitos — Empregae

## 1. Objetivo

Conectar **jovens aprendizes** a **empresas que precisam cumprir a cota obrigatória de aprendizagem** (Lei nº 10.097/2000 e art. 429 da CLT), usando um filtro inteligente que compara o perfil do jovem com a descrição das vagas.

## 2. Atores

| Ator | O que faz na plataforma |
|---|---|
| Jovem aprendiz | Cria perfil, descreve habilidades/interesses, envia vídeo de apresentação, busca vagas e se candidata. |
| Empresa | Cadastra-se, informa nº de funcionários, calcula a cota, publica vagas e vê candidatos compatíveis. |

## 3. Regras de negócio (base legal)

| Código | Regra |
|---|---|
| RN01 | A cota de aprendizes é de **no mínimo 5% e no máximo 15%** dos trabalhadores do estabelecimento cujas funções exigem formação profissional (art. 429 da CLT). |
| RN02 | Frações de unidade no cálculo da cota **arredondam para cima** (art. 429, §1º). Ex.: 30 funcionários × 5% = 1,5 → 2 aprendizes. |
| RN03 | Microempresas (ME) e empresas de pequeno porte (EPP) são **dispensadas** da cota (podem contratar de forma opcional). |
| RN04 | O aprendiz deve ter **entre 14 e 24 anos** (sem limite de idade para pessoa com deficiência). |
| RN05 | O cadastro do jovem **só é concluído** com aceite explícito da LGPD e da Lei da Aprendizagem. |
| RN06 | Dados de menores de idade são tratados conforme a LGPD (art. 14): uso mínimo e apenas para a finalidade de intermediação. |
| RN07 | Um jovem pode se candidatar **uma única vez** a cada vaga. |
| RN08 | "Vagas preenchidas" da empresa = candidaturas com status **contratado**. |

## 4. Requisitos funcionais

| Código | Requisito | Semana prevista |
|---|---|---|
| RF01 | Cadastro de jovem aprendiz (nome, e-mail, senha, data de nascimento, cidade, descrição, aceites). | 3 / 5 |
| RF02 | Cadastro de empresa (nome, CNPJ, e-mail, senha, total de funcionários). | 3 / 5 |
| RF03 | Login e logout para jovens e empresas. | 3 |
| RF04 | Atualização de perfil e envio de currículo/vídeo. | 3 |
| RF05 | Empresa publica, edita e encerra vagas. | 4 |
| RF06 | Filtro inteligente: ranking de vagas para o jovem e de candidatos para a empresa (similaridade de texto). | 4 |
| RF07 | Busca manual de vagas por cargo ou empresa. | 4 / 6 |
| RF08 | Jovem se candidata a uma vaga; empresa altera o status da candidatura. | 4 / 6 / 7 |
| RF09 | Cálculo da cota (mínima e máxima) e acompanhamento de vagas preenchidas. | 4 / 7 |
| RF10 | Envio do organograma da empresa. | 7 |
| RF11 | Chat entre empresa e candidato (mockup nesta versão). | 6 |

## 5. Requisitos não funcionais

| Código | Requisito |
|---|---|
| RNF01 | Backend em Python com FastAPI; banco PostgreSQL (Supabase em produção). |
| RNF02 | Frontend em HTML, CSS e JavaScript puro, consumindo a API via `fetch`. |
| RNF03 | Senhas armazenadas com hash (nunca em texto puro). |
| RNF04 | Configurações sensíveis (URL do banco, chaves) em variáveis de ambiente, fora do Git. |
| RNF05 | Interface responsiva (funciona em celular). |
| RNF06 | Deploy na nuvem Render. |

## 6. Modelo de dados (Semana 2)

```
empresas 1 ──── N vagas 1 ──── N candidaturas N ──── 1 jovens_aprendizes
```

- **empresas**: id, nome, cnpj, email, senha, total_funcionarios, criado_em
- **jovens_aprendizes**: id, nome, email, senha, data_nascimento, cidade, descricao, video_url, aceitou_lgpd, aceitou_lei_aprendizagem, criado_em
- **vagas**: id, titulo, descricao, aberta, empresa_id, criado_em
- **candidaturas**: id, jovem_id, vaga_id, status (`pendente`, `em_analise`, `contratado`, `recusado`), criado_em — par (jovem_id, vaga_id) único

## 7. Rotas da API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/saude` | Verifica se a API e o banco estão no ar |
| POST | `/jovens/` | Cadastra jovem aprendiz |
| POST | `/empresas/` | Cadastra empresa |
| POST | `/vagas/` | Publica vaga |
| GET | `/vagas/recomendadas/{jovem_id}` | Vagas ordenadas por compatibilidade com o jovem |
| GET | `/empresas/{empresa_id}/candidatos` | Candidatos compatíveis com as vagas da empresa |

## 8. Situação do protótipo inicial (diagnóstico)

| Item | Situação |
|---|---|
| Cadastro de jovem e empresa | Funciona, mas a senha é salva em texto puro e não existe login. |
| Filtro inteligente (TF-IDF) | Funciona. |
| Busca manual, candidatura, organograma | Apenas simulados na tela (não salvam nada). |
| Cálculo da cota | Só considera os 5% mínimos; não informa o máximo de 15%. |
| Vagas preenchidas | Sempre 0 (sem tabela de candidaturas no protótipo). |
