# syntax=docker/dockerfile:1

# ---- build: instala tudo, compila e remove dependências de desenvolvimento ----
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ---- runtime: só o necessário para executar ----
FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3001

# Aplica migrations pendentes e o seed idempotente de categorias antes de subir.
CMD ["sh", "-c", "node node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js && node dist/database/seeds/run-seeds.js && exec node dist/main.js"]
