// Резолвинг тем/подтем из строки "Тема → Подтема" в реальные Topic-записи (§18).
import "server-only";
import { db } from "@/lib/db";

function splitPath(path: string): string[] {
  return path
    .split(/→|>|\/|\|/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 3);
}

async function findOrCreate(name: string, parentId: string | null): Promise<string> {
  const existing = await db.topic.findFirst({
    where: { name: { equals: name }, parentId: parentId ?? null },
  });
  if (existing) return existing.id;
  const created = await db.topic.create({ data: { name, parentId } });
  return created.id;
}

/** "Маркетинг → Branding" → id листовой темы (создаёт недостающие уровни). */
export async function resolveTopicPath(path: string | null | undefined): Promise<string | null> {
  if (!path || !path.trim()) return null;
  const parts = splitPath(path);
  if (!parts.length) return null;
  let parentId: string | null = null;
  for (const name of parts) {
    parentId = await findOrCreate(name, parentId);
  }
  return parentId;
}

/** Текст, из которого считается эмбеддинг знания (для semantic search). */
export function knowledgeEmbedText(k: {
  title: string;
  content: string;
  keyPoints?: string[];
  tags?: string[];
}): string {
  return [k.title, k.content, (k.keyPoints ?? []).join(" "), (k.tags ?? []).join(" ")]
    .filter(Boolean)
    .join("\n");
}
