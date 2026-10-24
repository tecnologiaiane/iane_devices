# ==============================================================================
# Dockerfile para TelecomAsset Pro
# Suporte a Node.js 20 + Express + React SPA
# ==============================================================================

FROM node:20-alpine AS builder

WORKDIR /app

# Copia manifestos de dependência
COPY package*.json ./

# Instala dependências completas para o build
RUN npm install

# Copia o código-fonte
COPY . .

# Executa o build da aplicação React (gera dist/)
RUN npm run build

# ------------------------------------------------------------------------------
# Imagem Final de Execução (Leve e Segura)
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copia manifestos e instala apenas dependências de produção
COPY package*.json ./
RUN npm install --omit=dev && npm install -g tsx

# Copia os arquivos compilados do frontend e o backend
COPY --from=builder /app/dist ./dist
COPY server.ts ./
COPY init-db.sql ./

# Porta padrão de atendimento
EXPOSE 3000

# Executa o servidor Full-Stack
CMD ["tsx", "server.ts"]
