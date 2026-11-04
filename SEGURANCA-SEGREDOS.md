# SEGURANCA-SEGREDOS.md

Relatório de auditoria de segredos expostos no histórico do Git (somente leitura).
Não foram alterados arquivos do repositório. Os valores dos segredos são exibidos
apenas com os 3 primeiros caracteres, conforme solicitado.

Metodologia: varredura de todo o histórico (`git log -p --all`) e do working tree
(`git grep`) por padrões de senhas, hashes bcrypt, strings de conexão com
usuário/senha, JWT, chaves de API, IPs e hosts internos, e-mails corporativos.
Ferramentas gitleaks/trufflehog não estão instaladas no ambiente; a varredura foi
feita com `git log -p --all` + `grep`/`Select-String`.

## Resumo de achados

| # | Tipo | Arquivo(s) no working tree | Commit de introdução | Ainda no working tree? | Valor real ou exemplo? |
|---|------|----------------------------|----------------------|------------------------|------------------------|
| 1 | Senha em texto (testes) | `tests/server.test.ts` | `92aac60` | Sim | Exemplo/teste (`Teste...`) |
| 2 | Senha em texto (ADMIN testes) | `tests/server.test.ts` | `ce85dc6` | Sim | Teste (`Iane...`) |
| 3 | Hash bcrypt fixo (super admin) | `init-db.sql`, `server.ts` | `476d0f5` | Sim | Real (mesmo hash repetido) |
| 4 | String de conexão com usuário+senha | `.env.example`, `docker-compose.yml`, `README.md` | `64d9291` | Sim | Exemplo (`Sua...`) / teste (`Iane...`) |
| 5 | JWT_SECRET fixo/fallback | `server.ts`, `.env.example`, `docker-compose.yml`, `tests/server.test.ts`, `.github/workflows/ci.yml` | `335edd1` | Sim | Exemplo/dev (`troq...`, `iane...`) |
| 6 | Chave de API (Gemini) | `.env.example` | `b4d5486` | Sim | Exemplo (`MY_...`) |
| 7 | IP interno do servidor | `docker-compose.yml` (comentário/docs), `.env` docs | `92aac60` | Sim (docs/comentário) | Real (`10.0.0.45`) |
| 8 | Host interno (localhost) | `.env.example`, `README.md` | antigo | Sim | Local/dev (`loc...`) |
| 9 | E-mail corporativo | `init-db.sql`, `server.ts`, `src/services/dataStorage.ts`, `src/components/Sidebar.tsx`, `tests/server.test.ts` | `3f2ca53` | Sim | Real (`tec...`) |

## Detalhe por tipo

### 1. Senhas em texto plano
- `Teste@123` — usada em testes de login (`tests/server.test.ts`). Introduzida em `92aac60`. Ainda presente no working tree. Valor de exemplo/teste.
- `Iane@2026` — senha do admin de teste (`tests/server.test.ts`). Introduzida em `ce85dc6`. Ainda presente. Valor de teste.
- `Iane@admin` — senha do Postgres em versões antigas do `docker-compose.yml`. Introduzida em `fc830a7`/`ce85dc6`. Não está mais no working tree (substituída por variável de ambiente obrigatória).
- `admin | admin` — acesso inicial antigo (telas de login antigas). Introduzido em `64d9291`. Não está mais no working tree.

### 2. Hash bcrypt fixo (senha de super admin)
- Valor: `$2b$10$fng...` (comentário `// Iane@2026`).
- Arquivos no working tree: `init-db.sql` (linhas 150, 162), `server.ts` (linhas 100, 112, 390).
- Commit de introdução: `476d0f5`.
- Ainda no working tree: **Sim**.
- Real ou exemplo: **Real** — é o hash da senha do super admin cadastrado automaticamente. O mesmo hash aparece repetido em vários locais.

### 3. Strings de conexão com usuário e senha
- `postgres://iane_admin:SuaSenhaForteAqui123!@...` — `.env.example`, `README.md`. Exemplo.
- `postgres://iane_admin:Iane%40admin@postgres:5432/telecom_assets` — `docker-compose.yml` (histórico). Introduzido em `ce85dc6`. Não está mais no working tree.
- `postgres://iane_admin:SuaSenhaForteAqui123!@localhost:5432/telecom_assets` — histórico antigo. Não está mais no working tree.
- Ainda no working tree (exemplo): **Sim** (`.env.example:13`).

### 4. JWT_SECRET
- `troque-por-um-segredo-longo-e-aleatorio` — `.env.example`. Exemplo.
- `iane_telecom_dev_insecure_secret_change_me` — `server.ts` (fallback dev). Introduzido em `335edd1`. Exemplo/dev.
- `iane_telecom_default_secure_jwt_secret_2026` — `server.ts` (fallback). Introduzido em `dbaaa30`. Exemplo/dev.
- `iane_telecom_asset_secret_key_2026` — `server.ts` (fallback). Introduzido em `46c2f86`. Exemplo/dev.
- `ci-secret-apenas-para-testes` — `.github/workflows/ci.yml`. Exemplo de CI.
- Ainda no working tree: **Sim**.

### 5. Chave de API (Gemini)
- `GEMINI_API_KEY="MY_GEMINI_API_KEY"` — `.env.example`. Introduzido em `b4d5486`. Exemplo.
- Ainda no working tree: **Sim**.

### 6. IPs e hosts internos
- `10.0.0.45` — IP interno do servidor de produção (comentários/docs do `.env` e `docker-compose.yml`). Introduzido em `92aac60`. Ainda citado em documentação.
- `localhost` — `.env.example`, `README.md`. Host de desenvolvimento local.

### 7. E-mails corporativos
- `tecnologia@iane.ind.br` — `init-db.sql`, `server.ts`, `src/services/dataStorage.ts`, `src/components/Sidebar.tsx`. E-mail do super admin/sistema.
- `operador.teste@iane.ind.br` — `tests/server.test.ts`. E-mail de operador de teste.
- Ainda no working tree: **Sim**.

## Recomendações

1. Remover o hash bcrypt fixo do `init-db.sql` e `server.ts`; gerar o super admin via variável de ambiente ou comando de seed seguro.
2. Substituir fallbacks de `JWT_SECRET` fixos por geração aleatória obrigatória (`randomBytes`) sem valor default em produção.
3. Não commitar `.env` com senhas reais; manter apenas `.env.example` com valores de exemplo.
4. Remover senhas de teste (`Teste@123`, `Iane@2026`) dos testes de integração ou movê-las para variáveis de ambiente de teste.
5. Remover IPs internos (`10.0.0.45`) de comentários committados; documentar em wiki interna não versionada.
6. Considerar `git filter-repo` com o arquivo `expressions.txt` anexo para limpar o histórico, após revisão.
