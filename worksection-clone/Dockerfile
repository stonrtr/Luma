# Worksection-clone — образ для Railway/Render.
# БД в проде — PostgreSQL (через Prisma driver adapter @prisma/adapter-pg).
# Провайдер схемы переключается на postgresql на этапе сборки, адаптер в рантайме
# выбирается по DATABASE_URL (см. src/server/db.ts).

# ---------- build ----------
FROM node:22-slim AS build
WORKDIR /app

# системные зависимости для сборки нативных модулей (better-sqlite3 и т.п.)
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
# на сервере — Postgres: генерируем клиент под этот диалект
RUN sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma
RUN npx prisma generate --schema=./prisma/schema.prisma
RUN npm run build

# ---------- runtime ----------
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl curl \
  && rm -rf /var/lib/apt/lists/*

# переносим всё приложение целиком: нужны prisma CLI, tsx и next для миграций/сида/старта
COPY --from=build /app ./

EXPOSE 3100
CMD ["sh", "docker-entrypoint.sh"]
