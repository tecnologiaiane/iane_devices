# TelecomAsset Pro — Sistema de Gestão de Ativos de Telefonia Móvel

Sistema corporativo para gerenciamento patrimonial completo de smartphones, linhas telefônicas corporativas, termos de responsabilidade e histórico de custódia.

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
   - Cadastro detalhado com IMEI (validação 15 dígitos), número de série, patrimônio/TAG, valor de compra e conservação.
   - Linha do tempo (timeline) completa no drawer de detalhes do aparelho registrando cada passagem pelo estoque e períodos de uso por colaborador.
   - Filtros dinâmicos por status, operadora e departamento.

4. **Termos e Documentos**:
   - Geração e impressão de Termos de Entrega, Devolução e Transferência formatados.
   - Controle de status de assinatura (Pendente, Assinado, Não exigido).

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
- [Node.js](https://nodejs.org/) versão 18 ou superior
- [npm](https://www.npmjs.com/) ou [bun](https://bun.sh/)

### Instalação e Execução

```bash
# 1. Clonar o repositório
git clone <URL_DO_REPOSITORIO>
cd <PASTA_DO_PROJETO>

# 2. Instalar as dependências
npm install

# 3. Iniciar o servidor de desenvolvimento
npm run dev
```

Acesse no navegador: `http://localhost:3000`

### Build para Produção

```bash
npm run build
```

Os arquivos estáticos otimizados serão gerados na pasta `dist/`.

---

## 🔒 Licença

Propriedade corporativa desenvolvida para gestão patrimonial interna.
