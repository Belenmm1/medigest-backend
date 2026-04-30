# ═══════════════════════════════════════════════════════════════
# MediGest Pro — Dockerfile
# Multi-stage: builder → producción con imagen mínima
# ═══════════════════════════════════════════════════════════════

# ── Etapa 1: dependencias ──────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copiar solo manifiestos para cachear layer de npm install
COPY package*.json ./
RUN npm ci --only=production

# ── Etapa 2: imagen de producción ─────────────────────────────
FROM node:20-alpine AS production

# Seguridad: no correr como root
RUN addgroup -g 1001 -S nodejs && \
    adduser  -S medigest -u 1001 -G nodejs

WORKDIR /app

# Copiar node_modules del stage anterior
COPY --from=deps --chown=medigest:nodejs /app/node_modules ./node_modules

# Copiar código fuente
COPY --chown=medigest:nodejs . .

# Crear directorio de logs
RUN mkdir -p /app/logs && chown medigest:nodejs /app/logs

USER medigest

EXPOSE 3000

# Health check básico
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "src/index.js"]
