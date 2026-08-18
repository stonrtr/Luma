import { db } from "@/lib/db";
import { json, readJson, str, badRequest } from "@/lib/server/http";
import { toKnowledge } from "@/lib/serialize";
import { generateCard } from "@/lib/server/topicgen";
import { hasAnyLLM } from "@/lib/server/llm";

const KNOWLEDGE_INCLUDE = { collection: true } as const;

// GET /api/knowledge?collectionId=&archived=&q=&sort=
export async function GET(req: Request) {
  const url = new URL(req.url);
  const collectionId = url.searchParams.get("collectionId");
  const archived = url.searchParams.get("archived") === "true";
  const q = (url.searchParams.get("q") || "").trim();
  const sort = url.searchParams.get("sort") || "recent";

  const where: Record<string, unknown> = { archived };
  if (collectionId === "none") where.collectionId = null;
  else if (collectionId) where.collectionId = collectionId;
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { sourceText: { contains: q } },
      { question: { contains: q } },
    ];
  }

  const orderBy =
    sort === "title"
      ? [{ title: "asc" as const }]
      : sort === "due"
        ? [{ dueAt: "asc" as const }]
        : sort === "progress"
          ? [{ progress: "asc" as const }]
          : [{ createdAt: "desc" as const }];

  const rows = await db.knowledge.findMany({ where, orderBy, include: KNOWLEDGE_INCLUDE });
  return json(rows.map(toKnowledge));
}

// POST /api/knowledge  { sourceText, title?, collectionId? }
// Creates the topic and generates its recall card inline.
export async function POST(req: Request) {
  const body = await readJson(req);
  const sourceText = str(body.sourceText, 20000).trim();
  const title = str(body.title, 200).trim();
  const collectionId = body.collectionId ? str(body.collectionId, 60) : null;
  if (!sourceText) return badRequest("Вставьте текст темы");

  const fallbackTitle = title || firstLine(sourceText);

  if (!hasAnyLLM()) {
    // No AI configured — save the note, leave a manual question the user can edit.
    const row = await db.knowledge.create({
      data: {
        title: fallbackTitle,
        sourceText,
        collectionId,
        question: `Вспомни и перескажи тему: «${fallbackTitle}»`,
        keyPoints: "[]",
        genStatus: "failed",
        genError: "LLM не настроен (нет ключа). Вопрос можно написать вручную.",
      },
      include: KNOWLEDGE_INCLUDE,
    });
    return json(toKnowledge(row), { status: 201 });
  }

  try {
    const card = await generateCard(sourceText, title || undefined);
    const row = await db.knowledge.create({
      data: {
        title: card.title || fallbackTitle,
        sourceText,
        collectionId,
        question: card.question,
        keyPoints: JSON.stringify(card.keyPoints),
        genStatus: "ready",
        genError: "",
      },
      include: KNOWLEDGE_INCLUDE,
    });
    return json(toKnowledge(row), { status: 201 });
  } catch (e) {
    const row = await db.knowledge.create({
      data: {
        title: fallbackTitle,
        sourceText,
        collectionId,
        question: `Вспомни и перескажи тему: «${fallbackTitle}»`,
        keyPoints: "[]",
        genStatus: "failed",
        genError: (e as Error).message.slice(0, 500),
      },
      include: KNOWLEDGE_INCLUDE,
    });
    return json(toKnowledge(row), { status: 201 });
  }
}

function firstLine(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "Тема";
  return line.trim().slice(0, 80);
}
