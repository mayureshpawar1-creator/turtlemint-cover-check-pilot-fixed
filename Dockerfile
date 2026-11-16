# Cover Check — one image: API + web app on the same domain.
#   docker build -t cover-check .
#   docker run --env-file .env.production -p 8080:8080 cover-check
# On start it applies any new database migrations, then serves on :8080 (/healthz, /readyz for the load balancer).

# ---- 1. install (cached until a package.json changes)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# ---- 2. test + build the web app
# Backend tests need PostgreSQL, which a docker build does not have; they run in CI (.github/workflows/ci.yml).
FROM deps AS build
COPY . .
RUN npm test -w shared \
 && npm run typecheck -w backend \
 && npm run build -w frontend

# ---- 3. runtime
FROM node:22-alpine AS runtime
ENV NODE_ENV=production PORT=8080 WEB_DIST=/app/frontend/dist
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY package.json tsconfig.base.json ./
COPY shared shared
COPY backend backend
COPY data data
COPY --from=build /app/frontend/dist frontend/dist
RUN mkdir -p backend/.data exports && chown -R node:node backend/.data exports
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
CMD ["npm", "start"]
