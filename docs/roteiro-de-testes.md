# Roteiro de testes de ponta a ponta — Empregae

Percorre a jornada completa pelas telas: empresa → vagas → jovem → filtro inteligente →
candidatura → contratação → cota. Serve como teste manual e como roteiro de demonstração
(cerca de 10 minutos).

O mesmo fluxo é verificado automaticamente pela API no teste
`test_jornada_completa_ponta_a_ponta` em [`backend/tests/test_api.py`](../backend/tests/test_api.py)
(rode `pytest` na pasta `backend`).

## Antes de começar

1. Suba a API: `cd backend && source venv/bin/activate && uvicorn main:app --reload`
2. Abra http://localhost:8000
3. Use e-mails que ainda não existam no banco (ex.: troque o número em `rh1@...`, `joana1@...`).
4. Dica: use **duas janelas anônimas** (uma para a empresa, outra para o jovem). Abas comuns
   do mesmo navegador compartilham a sessão.

## Parte 1 — Empresa

| # | O que fazer | O que deve acontecer |
|---|---|---|
| 1 | Página inicial → **Sou empresa**. Preencha nome, e-mail, senha (6+ caracteres). Deixe o CNPJ vazio. | Abre o **Painel da Empresa**. No topo: "Cota ainda não calculada". |
| 2 | Teste de erro: saia, tente cadastrar de novo com o **mesmo e-mail**. | Mensagem vermelha: "Este e-mail já está cadastrado." |
| 3 | Entre de novo (**Entrar → Empresa**). Aba **Organograma e cota**: adicione `Loja — 25 — exige formação ✔` e `Diretoria — 2 — exige formação ✘`. | Enquanto digita, o cálculo mostra: total **27**, em funções com formação **25**, cota mínima **2**, máximo **3**. |
| 4 | Clique **Salvar organograma**. | Aviso "Organograma salvo!". No topo: "Cota: 0 de 2 aprendizes · Faltam 2". |
| 5 | Ainda nessa aba, em **Dados da empresa**: área "Varejo", cidade, site `www.exemplo.com.br`, "Sobre a empresa". Salve. | Aviso "Dados da empresa atualizados". O site vira `https://www.exemplo.com.br`. |
| 6 | Aba **Minhas vagas**: publique **Auxiliar de Logística** ("Separar mercadorias no estoque e conferir notas fiscais.") e **Assistente Administrativo** ("Organizar documentos e arquivos do escritório e atender telefone."). | As duas vagas aparecem na lista, mais nova primeiro, com o selo **Aberta**. |

## Parte 2 — Jovem (outra janela anônima)

| # | O que fazer | O que deve acontecer |
|---|---|---|
| 7 | Abra http://localhost:8000 | Na seção **Vagas abertas agora** aparecem as duas vagas, sem precisar de login. |
| 8 | **Sou jovem aprendiz**. Em "Sobre você": "Gosto de organizar documentos e arquivos, tenho facilidade com computador e quero trabalhar em escritório." Tente enviar **sem marcar** os termos. | O navegador não deixa enviar sem os aceites da LGPD e da Lei da Aprendizagem. |
| 9 | Marque os termos e crie o perfil. | Abre **Olá, [nome]!** com a aba **Vagas para você**. **Assistente Administrativo** aparece **em primeiro**, com a maior compatibilidade. |
| 10 | Busque `estoque`. | Só **Auxiliar de Logística** aparece. Clique **Limpar busca**. |
| 11 | Clique no **nome da empresa** em um cartão. | Abre o perfil da empresa: área, cidade, site, apresentação e as 2 vagas abertas. Não aparecem e-mail, CNPJ nem cota. |
| 12 | No perfil, **Candidatar-se** em Assistente Administrativo. | Aviso "Candidatura enviada!"; o botão vira **Candidatura enviada ✔**. |
| 13 | Aba **Meu perfil**: envie um PDF como currículo. | Selo **Enviado**; "Perfil X% completo" aumenta. **Ver** abre o PDF em nova aba. |
| 14 | Aba **Minhas candidaturas**. | A candidatura aparece com status **Enviada**. |

## Parte 3 — Empresa avalia e contrata (janela da empresa)

| # | O que fazer | O que deve acontecer |
|---|---|---|
| 15 | Recarregue o painel. Aba **Candidaturas**. | A candidatura do jovem aparece com selo **Nova**, compatibilidade e botões **Currículo** e **E-mail**. |
| 16 | Clique **Currículo**. | O PDF enviado no passo 13 abre em nova aba. |
| 17 | Aba **Candidatos compatíveis**. | As vagas aparecem com os jovens compatíveis; o jovem tem o selo **Já se candidatou**. |
| 18 | Volte em **Candidaturas** e mude o status para **Contratado**. | Aviso "Candidato contratado! A cota foi atualizada." No topo: **Cota: 1 de 2 aprendizes · Faltam 1**. |

## Parte 4 — Fechamento

| # | O que fazer | O que deve acontecer |
|---|---|---|
| 19 | Na janela do jovem, recarregue e abra **Minhas candidaturas**. | Status **Contratado(a)!** em verde. |
| 20 | Clique no ícone de **sol/lua** na barra superior. | A tela alterna entre tema claro e escuro; a escolha fica salva. |
| 21 | No Supabase → **Table Editor** → `jovens_aprendizes`. | A coluna `senha_hash` mostra `$2b$...`, e não a senha digitada. |
| 22 | Abra http://localhost:8000/docs | A documentação automática da API lista todas as rotas. |

## Se algo der errado

| Sintoma | Causa provável |
|---|---|
| "Não foi possível conectar ao servidor" | A API não está rodando (passo "Antes de começar"). |
| Erro 500 / página não carrega dados | Supabase pausado: no painel do Supabase, **Restore project**. |
| Aparece o usuário errado no topo | Duas contas na mesma janela: use janelas anônimas separadas. |
