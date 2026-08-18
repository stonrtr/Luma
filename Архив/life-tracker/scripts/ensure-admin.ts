import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

// Прод-сид: только гарантируем наличие владельца (OWNER) из ADMIN_* env. Без демо-данных.
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@worksection.local";
  const name = process.env.ADMIN_NAME ?? "Admin";
  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD ?? "Password1!", 10);
  await db.user.upsert({
    where: { email },
    update: {},
    create: {
      name, firstName: name, lastName: "",
      email, passwordHash, role: "OWNER", locale: "uk", weeklyHours: 40,
    },
  });
  console.log("✓ admin ensured:", email);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(0); });
