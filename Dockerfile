# ================================================================
# OEM Driver Explorer - Dockerfile para despliegue en Coolify
# Dominio objetivo: oem.elfakir.com
# ================================================================

FROM node:24-alpine AS runner

# Metadatos del contenedor
LABEL maintainer="El Fakir <oem.elfakir.com>"
LABEL description="OEM Driver Matrix Explorer - Auditoria de Flota Lenovo y HP"

WORKDIR /app

# Instalar wget para healthcheck de contenedor
RUN apk add --no-cache wget

# Configuracion de variables de entorno de produccion
ENV NODE_ENV=production
ENV PORT=3000

# Copiar manifiestos de paquetes
COPY package*.json ./

# Instalar unicamente dependencias de produccion (excluye electron, nodemon, etc.)
RUN npm install --omit=dev --no-audit --no-fund

# Copiar el codigo fuente y activos estaticos
COPY server.js ./
COPY lib/ ./lib/
COPY public/ ./public/
COPY routes/ ./routes/
COPY middleware/ ./middleware/

# Crear carpeta de datos para SQLite y asignar permisos
RUN mkdir -p /app/data && chown -R node:node /app
USER node

# Puerto expuesto para Coolify / Reverse Proxy Traefik
EXPOSE 3000

# Verificacion de estado de salud (Healthcheck)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

# Comando de inicio del servidor Express
CMD ["node", "server.js"]
