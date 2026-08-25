import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { estimateDifficulty } from "../lib/difficulty";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/luma.db" });
const db = new PrismaClient({ adapter });

type SeedPhrase = { en: string; ru: string; alts?: string[]; exEn?: string; exRu?: string; tr?: string };

const businessPhrases: SeedPhrase[] = [
  { en: "a significant achievement", ru: "значительное достижение", alts: ["существенное достижение"], exEn: "Completing the project on time was a significant achievement.", exRu: "Завершение проекта в срок стало значительным достижением.", tr: "/ə sɪɡˈnɪfɪkənt əˈtʃiːvmənt/" },
  { en: "to meet a deadline", ru: "уложиться в срок", alts: ["соблюсти дедлайн"], exEn: "We worked overtime to meet the deadline.", exRu: "Мы работали сверхурочно, чтобы уложиться в срок.", tr: "/tə miːt ə ˈdedlaɪn/" },
  { en: "to follow up", ru: "проследить, напомнить", alts: ["связаться повторно"], exEn: "I'll follow up with the client tomorrow.", exRu: "Я свяжусь с клиентом повторно завтра.", tr: "/tə ˈfɒləʊ ʌp/" },
];

const dailyPhrases: SeedPhrase[] = [
  { en: "on purpose", ru: "нарочно, специально", alts: ["намеренно"], exEn: "He did it on purpose.", exRu: "Он сделал это нарочно.", tr: "/ɒn ˈpɜːpəs/" },
  { en: "to run out of", ru: "закончиться (о запасе)", alts: ["исчерпать"], exEn: "We ran out of coffee this morning.", exRu: "У нас закончился кофе сегодня утром.", tr: "/tə rʌn aʊt əv/" },
  { en: "to make up one's mind", ru: "принять решение", alts: ["решиться"], exEn: "She couldn't make up her mind.", exRu: "Она никак не могла принять решение.", tr: "/tə meɪk ʌp wʌnz maɪnd/" },
];

async function seedLesson(title: string, topicId: string | null, phrases: SeedPhrase[]) {
  const lesson = await db.lesson.create({ data: { title, topicId } });
  const now = new Date();
  for (const p of phrases) {
    await db.phraseCard.create({
      data: {
        lessonId: lesson.id,
        english: p.en,
        russian: p.ru,
        alternativeTranslations: JSON.stringify(p.alts ?? []),
        transcription: p.tr ?? "",
        exampleEn: p.exEn ?? "",
        exampleRu: p.exRu ?? "",
        difficulty: estimateDifficulty(p.en),
        translationStatus: "ready",
        progress: 0,
        dueAt: now, // new but due, so it appears in "Today"
        source: JSON.stringify({ type: "manual" }),
      },
    });
  }
  return lesson;
}

async function main() {
  await db.userSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });

  if ((await db.lesson.count()) > 0) {
    console.log("Lessons already exist — skipping content seed.");
    return;
  }

  const business = await db.topic.create({ data: { name: "Бизнес", position: 0 } });
  const daily = await db.topic.create({ data: { name: "Повседневное общение", position: 1 } });

  await seedLesson("Деловая переписка", business.id, businessPhrases);
  await seedLesson("Фразовые глаголы", daily.id, dailyPhrases);
  await seedLesson("Без темы — разное", null, [
    { en: "by the way", ru: "кстати", exEn: "By the way, did you call him?", exRu: "Кстати, ты ему звонил?" },
  ]);

  console.log("Seed complete.");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
