import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Адаптер выбирается по схеме DATABASE_URL: postgres:// → Neon serverless (Cloudflare Workers-friendly,
// работает через fetch/WebSocket без TCP-сокетов), иначе SQLite (локальная разработка).
// Диалект SQL задаётся провайдером схемы на этапе `prisma generate` (в проде образ собирается с provider = postgresql).
function makeAdapter() {
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaNeon } = require("@prisma/adapter-neon");
    // Neon-драйвер ходит по WebSocket. На Cloudflare Workers WS встроенный;
    // в Node 22 берём глобальный WebSocket (пакет `ws` не нужен).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { neonConfig } = require("@neondatabase/serverless");
    if (!neonConfig.webSocketConstructor && typeof globalThis.WebSocket !== "undefined") {
      neonConfig.webSocketConstructor = globalThis.WebSocket;
    }
    return new PrismaNeon({ connectionString: url });
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
  return new PrismaBetterSqlite3({ url });
}

export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter: makeAdapter() });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
