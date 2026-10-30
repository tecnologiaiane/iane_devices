# IANE - Gestão de Dispositivos

Sistema corporativo para gerenciamento patrimonial completo de smartphones, linhas telefônicas corporativas, termos de responsabilidade e histórico de custódia da IANE - Industria de Alimentos do Nordeste LTDA.

Desenvolvido para modernizar e substituir controles manuais em planilhas (*Dashboard*, *Analítico* e *Base de Dados*), garantindo integridade e conformidade nos processos de entrega, devolução, transferência e troca de aparelhos.

---

## 🚀 Funcionalidades Principais

1. **Dashboard Executivo e Operacional**:
   - Indicadores em tempo real de ativos (em uso, disponíveis em estoque, em avaliação, em manutenção, baixados).
   - Indicadores de linhas telefônicas (ativas, disponíveis, suspensas e canceladas).
   - Gráficos de distribuição por status, marca, modelo e departamento.
   - Painel de pendências e inconsistências patrimoniais.

2. **Fluxo Oficial de Movimentação (Custódia do Gestor)**:
   - **Entrega de Dispositivo** (`Estoque → Colaborador`): entrega de aparelho disponível com vinculação de linha e emissão do termo.
   - **Devolução de Dispositivo** (`Colaborador → Estoque do Gestor de Telefonia`): recolhimento com conferência de estado e acessórios.
   - **Transferência entre Colaboradores** (`Colaborador A → Estoque → Colaborador B`): operação atômica em 2 etapas vinculadas pelo mesmo `batchOperationId`. Se reprovado na avaliação técnica, o bem permanece em estoque.
   - **Troca de Aparelho** (`Colaborador A [Antigo] → Estoque | Estoque [Novo] → Colaborador A`): substituição rápida em lote com histórico auditável.

3. **Gestão de Dispositivos e Linhas**:
   - Cadastro detalhado com IMEI e Número de Série **opcionais** (validados apenas quando informados), patrimônio/TAG, valor de compra e conservação.
   - Linha do tempo (timeline) completa no drawer de detalhes do aparelho registrando cada passagem pelo estoque e períodos de uso por colaborador.
   - Filtros dinâmicos por status, operadora e departamento.

4. **Termos e Documentos**:
   - Geração e impressão de Termos de Entrega, Devolução e Transferência formatados.
   - **Cadastro de termo já existente por upload do PDF original** (arquivo do computador do usuário), com vínculo opcional a aparelho e colaborador já cadastrados. Limite de **10 MB no aplicativo** e **15 MB no servidor**.
   - Na movimentação, escolha entre **gerar o termo pelo aplicativo** ou **vincular um termo já existente** — inclusive com cadastro rápido do termo (com PDF) sem sair da tela.
   - Visualização do PDF anexado no próprio sistema, com abrir em nova aba, baixar e imprimir.
   - Controle de status de assinatura (Pendente, Assinado, Arquivado).

   > O PDF é enviado em base64 no corpo JSON e gravado na coluna `terms_documents.file_data`. Ele não entra no cache local do navegador nem na fila offline: o cadastro com PDF é síncrono e, se o servidor estiver indisponível, o erro é exibido na hora.

5. **Relatórios e Migração de Dados**:
   - Exportação em CSV de relatórios de inventário, linhas órfãs e custos.
   - Assistente de Migração em 3 etapas para importação direta de planilhas existentes (*Base de Dados* e *Analítico*).
   - Backup e Restauração completa da base em formato JSON.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler & Dev Server**: [Vite](https://vitejs.dev/)
- **Estilização**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Ícones**: [Lucide React](https://lucide.dev/)
- **Animações**: [Motion](https://motion.dev/)

---

## 💻 Como Executar Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) versão 22 LTS (ou 20.19+)
- [npm](https://www.npmjs.com/)
- PostgreSQL 16 (opcional em desenvolvimento; obrigatório em produção)

### Instalação e Execução

```bash
# 1. Clonar o repositório
git clone <URL_DO_REPOSITORIO>
cd <PASTA_DO_PROJETO>

# 2. Instalar as dependências
npm install

# 3. Configurar as variáveis de ambiente
cp .env.example .env
# edite o .env com DATABASE_URL, JWT_SECRET etc.

# 4. Iniciar o servidor de desenvolvimento
npm run dev
```

Acesse no navegador: `http://localhost:3000`

Sem PostgreSQL, use `ALLOW_MEMORY_FALLBACK=true` **apenas em desenvolvimento** (os dados não são persistidos no servidor).

### Testes, lint e build

```bash
npm run lint    # verificação de tipos (TypeScript strict)
npm test        # testes de datas, formatadores e API (node:test + tsx)
npm run build   # build de produção em dist/
```

A suíte `npm test` sobe a API em porta efêmera, sem PostgreSQL (`SKIP_VITE=true`, `ALLOW_MEMORY_FALLBACK=true`) e cobre login, RBAC por módulo, revogação de sessão, auditoria e sincronização em lote. O workflow `.github/workflows/ci.yml` executa lint, testes e build a cada push/PR.

### Build para Produção

```bash
npm run build
```

Os arquivos estáticos otimizados serão gerados na pasta `dist/`. As telas e modais são carregados sob demanda (`React.lazy`), com dependências separadas em chunks de longa duração (`vendor-react`, `vendor-icons`, `vendor-http`).

### Rotas da aplicação

Cada aba possui URL própria (navegação direta e recarregamento funcionam no servidor Express):

`/login` · `/dashboard` · `/dispositivos` · `/linhas` · `/colaboradores` · `/movimentacoes` · `/termos` · `/relatorios` · `/configuracoes`

`/login` é uma rota real: sem sessão ativa, qualquer caminho protegido redireciona para `/login` guardando a origem; após autenticar, o usuário volta ao caminho solicitado.

### Segurança e permissões (RBAC)

| Variável | Descrição |
| --- | --- |
| `JWT_SECRET` | **Obrigatória em produção.** Segredo longo e aleatório para assinar os tokens (ex.: `openssl rand -hex 48`). Sem ela, o servidor gera um segredo efêmero e as sessões caem a cada reinício. |
| `JWT_EXPIRES_IN` | Validade da sessão. Padrão `12h` (ex.: `8h`, `1d`). |
| `DATABASE_URL` | String de conexão do PostgreSQL. **Obrigatória** no `docker-compose`. |
| `POSTGRES_PASSWORD` | Senha do banco usada pelo `docker-compose`. **Obrigatória**. |
| `ALLOW_MEMORY_FALLBACK` | Apenas desenvolvimento. Com `true`, permite operar sem PostgreSQL (sem persistência real). Em produção mantenha `false`. |
| `TZ` | Fuso horário do servidor e do banco. Padrão `America/Sao_Paulo` (datas sem deslocamento UTC). |

- **Autenticação**: todas as rotas `/api/*` exigem token JWT, exceto `/api/health` e `/api/auth/login`.
- **Leitura**: liberada para quem possui ao menos um módulo (`dashboard`, `dispositivos`, `linhas`, `colaboradores`, `movimentacoes`, `termos`, `relatorios`, `configuracoes`).
- **Escrita**: exige a permissão do módulo — `dispositivos_edit`, `linhas_edit`, `colaboradores_edit`, `movimentacoes` (movimentações e transferências) e `termos`.
- **Administração**: `/api/users`, reset do banco e backup exigem `manage_users`/perfil `admin`.
- **Revogação de sessão**: cada usuário possui `token_version`; logout, troca de senha, alteração de papel/permissões ou desativação invalidam imediatamente os tokens já emitidos.
- **Auditoria**: o autor do log vem sempre do token autenticado, nunca do corpo da requisição.
- **Seed idempotente**: os superusuários padrão usam `ON CONFLICT DO NOTHING` — a senha alterada pelo administrador nunca é sobrescrita em reinícios.

### Docker

```bash
# 1. Gere o .env (senha do banco, segredo JWT e URL de conexão)
cd /opt/iane_devices
PGPASS=$(openssl rand -hex 24)
JWT=$(openssl rand -hex 48)
sudo tee .env > /dev/null <<EOF
POSTGRES_PASSWORD=$PGPASS
JWT_SECRET=$JWT
DATABASE_URL=postgresql://iane_admin:$PGPASS@postgres:5432/telecom_assets
TZ=America/Sao_Paulo
EOF

# 2. Garanta que o usuário que roda o compose consiga ler o arquivo
sudo chown "$USER":"$USER" .env
chmod 600 .env

# 3. Valide e suba
docker compose config --quiet
docker compose up -d --build
```

> `sudo cat > .env` **não funciona**: o `sudo` vale para o `cat`, mas o redirecionamento `>` é executado pelo seu shell e continua sem permissão. Use `sudo tee` (ou `sudo mv` de um arquivo temporário).

> Se o volume `postgres_data` já existe, `POSTGRES_PASSWORD` precisa ser a senha com que o banco foi inicializado; alterar a variável não muda a senha dentro do volume. Trocar implica recriar o volume (`docker compose down -v`), o que apaga os dados.

O compose recusa iniciar sem `POSTGRES_PASSWORD`, `DATABASE_URL` e `JWT_SECRET` definidos. Por padrão, a porta do PostgreSQL é publicada apenas em `127.0.0.1:5432` (acesso administrativo local). Para liberar acesso externo, defina `POSTGRES_BIND_IP=0.0.0.0` no `.env` e restrinja a porta 5432 ao firewall da rede interna. O container da aplicação define `TZ=America/Sao_Paulo` e `ALLOW_MEMORY_FALLBACK=false`. Senhas com caracteres especiais (`@`, `#`, `/`, `:`) precisam ser codificadas na URL do `DATABASE_URL` (ex.: `@` → `%40`).

#### Login retorna 503 e o log mostra `password authentication failed`

O volume do PostgreSQL guarda a senha definida na **primeira** inicialização. Se o `.env` foi recriado depois, a senha do arquivo não é a mesma do banco — e o app fica em retry eterno. Confirme com uma conexão TCP (o `psql` sem `-h` usa o socket local em `trust` e **não** valida senha):

```bash
cd /opt/iane_devices
PGPASS="$(grep '^POSTGRES_PASSWORD=' .env | cut -d= -f2-)"

# Deve falhar se a senha do .env divergir do volume
docker compose exec -T -e PGPASSWORD="$PGPASS" postgres \
  psql -h 127.0.0.1 -U iane_admin -d telecom_assets -c 'select 1;'
```

Para alinhar o banco ao `.env` **sem perder dados** (conexão local em `trust` permite alterar a senha):

```bash
docker compose exec -T postgres psql -U iane_admin -d telecom_assets \
  -c "ALTER USER iane_admin WITH PASSWORD '$PGPASS';"

docker compose restart app
curl -s http://localhost:3000/api/health   # database: "connected"
```

Alternativa (somente se não houver dados a preservar): `docker compose down -v && docker compose up -d --build`.

#### DBeaver / acesso externo ao PostgreSQL

Como a porta é publicada em `127.0.0.1` por padrão, conexões de outra máquina são recusadas. A opção mais segura é usar túnel SSH:

```bash
ssh -L 5433:127.0.0.1:5432 iane@app04
# no DBeaver: host localhost, porta 5433, banco telecom_assets, usuário iane_admin
```

Para conectar diretamente pelo IP do servidor, defina no `.env` o IP da interface interna (ex.: `10.0.0.45`) ou `0.0.0.0`:

```bash
POSTGRES_BIND_IP=10.0.0.45
```

Depois recrie o container e libere a porta 5432 apenas para a rede interna no firewall:

```bash
docker compose up -d postgres
# no DBeaver: host 10.0.0.45, porta 5432, banco telecom_assets, usuário iane_admin
```

Evite expor a porta 5432 para a internet.


---

## 🔒 Licença

Propriedade corporativa desenvolvida para gestão patrimonial interna.
