# ==============================================================================
# Dockerfile para IANE - Gestão de Dispositivos
# Suporte a Node.js 20 + Express + React SPA
# ==============================================================================

FROM node:20-alpine AS builder

WORKDIR /app

# Copia manifestos de dependência
COPY package*.json ./

# Instala dependências de forma determinística (build reproduzível)
RUN npm ci --legacy-peer-deps

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
ENV BACKUP_DIR=/app/backups
ENV TZ=America/Sao_Paulo

# tzdata garante que as datas/horas locais (America/Sao_Paulo) sejam calculadas corretamente.
RUN apk add --no-cache tzdata

# Copia manifestos e instala apenas dependências de produção (inclui tsx localmente)
COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps

# Copia os arquivos compilados do frontend e o backend
COPY --from=builder /app/dist ./dist
COPY server.ts ./server.ts
COPY init-db.sql ./init-db.sql
# Configurações compartilhadas importadas pelo backend em runtime.
COPY src/config ./src/config

# Pasta das cópias de segurança (montada como volume no docker-compose)
RUN mkdir -p /app/backups && chown node:node /app/backups

# Porta padrão de atendimento
EXPOSE 3000

# Não roda como root: reduz superfície de ataque em caso de comprometimento.
USER node

# Healthcheck: verifica se a API responde antes de considerar o container saudável.
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

# Executa o servidor Full-Stack com tsx instalado localmente (sem -g).
CMD ["node_modules/.bin/tsx", "server.ts"]
