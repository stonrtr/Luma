import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/recall.db",
});
const db = new PrismaClient({ adapter });

type SeedTopic = {
  title: string;
  question: string;
  keyPoints: string[];
  sourceText: string;
};

const topics: SeedTopic[] = [
  {
    title: "Интервальное повторение",
    question: "Что такое интервальное повторение и почему оно помогает не забывать?",
    keyPoints: [
      "Кривая забывания Эббингауза: без повторений память быстро угасает",
      "Повторять материал с растущими интервалами",
      "Каждое успешное вспоминание удлиняет следующий интервал",
      "Активное вспоминание сильнее пассивного перечитывания",
    ],
    sourceText:
      "Интервальное повторение — метод обучения, при котором материал повторяют через увеличивающиеся промежутки времени. Он основан на кривой забывания Эббингауза: без повторения новая информация быстро теряется. Если вспоминать материал в правильные моменты — как раз перед тем, как забыть, — память закрепляется всё прочнее, и интервал до следующего повторения можно увеличивать. Ключевую роль играет активное вспоминание (retrieval practice): попытка достать знание из памяти по вопросу работает лучше, чем простое перечитывание конспекта.",
  },
  {
    title: "Митохондрия",
    question: "Расскажи о митохондрии: её функция и ключевые особенности.",
    keyPoints: [
      "«Энергетическая станция» клетки",
      "Производит АТФ в процессе клеточного дыхания",
      "Имеет двойную мембрану; внутренняя образует кристы",
      "Содержит собственную ДНК",
    ],
    sourceText:
      "Митохондрия — органелла эукариотической клетки, которую называют её «энергетической станцией». Основная функция — синтез АТФ в ходе клеточного дыхания (окислительного фосфорилирования). Митохондрия имеет двойную мембрану: наружную гладкую и внутреннюю, образующую складки — кристы, на которых расположены ферменты дыхательной цепи. Митохондрии содержат собственную кольцевую ДНК и рибосомы, что подтверждает эндосимбиотическую теорию их происхождения.",
  },
];

async function main() {
  const collection = await db.collection.create({ data: { name: "Примеры", position: 0 } });
  for (const t of topics) {
    await db.knowledge.create({
      data: {
        title: t.title,
        question: t.question,
        keyPoints: JSON.stringify(t.keyPoints),
        sourceText: t.sourceText,
        collectionId: collection.id,
        genStatus: "ready",
      },
    });
  }
  await db.userSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
  console.log(`Seeded ${topics.length} example topics.`);
}

main().finally(() => db.$disconnect());
