# ---------- Stage 1: build the React frontend ----------
FROM node:22-alpine AS web

WORKDIR /web
COPY web/package*.json ./
RUN npm install --no-audit --no-fund
COPY web ./
RUN npm run build

# ---------- Stage 2: install production dependencies ----------
FROM node:22-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# ---------- Stage 3: minimal runtime image ----------
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Writable dir for deployment history (also mounted as emptyDir in k8s)
RUN mkdir -p /app/data && chown node:node /app/data

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY app ./app
COPY policy-engine ./policy-engine
COPY deployment ./deployment
COPY argocd/application.yaml argocd/syncApplication.js ./argocd/
COPY --from=web /web/dist ./web/dist

EXPOSE 3000

# Never run Node apps as root
USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "app/server.js"]
