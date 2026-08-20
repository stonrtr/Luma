// Демо-данные для проверки экранов (§20, §27). Запуск: npx tsx prisma/seed.ts
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const url = process.env.DATABASE_URL || "file:./prisma/recall.db";
const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

async function main() {
  await db.knowledgeLink.deleteMany();
  await db.card.deleteMany();
  await db.knowledge.deleteMany();
  await db.draftBlock.deleteMany();
  await db.draft.deleteMany();
  await db.source.deleteMany();
  await db.topic.deleteMany();

  const marketing = await db.topic.create({ data: { name: "Маркетинг" } });
  const branding = await db.topic.create({ data: { name: "Branding", parentId: marketing.id } });

  const source = await db.source.create({
    data: {
      type: "YOUTUBE",
      title: "How Brands Grow — Explained",
      author: "Marketing Channel",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      duration: 2820,
      status: "COMPLETED",
      rawContent: "Пример транскрипта о том, как растут бренды…",
    },
  });

  const mental = await db.knowledge.create({
    data: {
      title: "Mental Availability",
      content:
        "Вероятность того, что бренд вспомнят в ситуации покупки. Чем в большем числе ситуаций бренд приходит на ум, тем выше его шансы быть купленным.",
      keyPoints: JSON.stringify([
        "Бренд должен приходить на ум в момент покупки",
        "Растёт через category entry points",
        "Поддерживается distinctive assets",
      ]),
      tags: JSON.stringify(["mental availability", "brand growth", "memory"]),
      topicId: branding.id,
      sourceId: source.id,
      sourceStart: 762,
      sourceEnd: 977,
      importance: 3,
      favorite: true,
    },
  });

  await db.knowledge.create({
    data: {
      title: "Category Entry Points",
      content:
        "Ситуации, мысли и потребности, которые запускают выбор в категории. Бренд должен ассоциироваться с как можно большим их числом.",
      keyPoints: JSON.stringify([
        "Триггеры выбора в категории",
        "Больше CEP → выше mental availability",
      ]),
      tags: JSON.stringify(["cep", "brand growth"]),
      topicId: branding.id,
      sourceId: source.id,
      sourceStart: 980,
      sourceEnd: 1630,
      importance: 2,
    },
  });

  await db.card.create({
    data: {
      knowledgeId: mental.id,
      question: "Что такое Mental Availability?",
      answer:
        "Вероятность того, что бренд вспомнят в ситуации покупки. Растёт через category entry points.",
      dueAt: new Date(),
    },
  });

  console.log("Seed готов: 2 темы, 1 источник, 2 знания, 1 карточка.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
