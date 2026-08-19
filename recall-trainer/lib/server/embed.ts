// Векторные эмбеддинги для semantic search (§22) и поиска дублей (§36).
// Gemini text-embedding-004 (768-мерный). При отсутствии ключа — null, тогда
// система тихо откатывается на keyword-поиск.
import "server-only";

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "text-embedding-004";

export function hasEmbeddings(): boolean {
  return GEMINI_KEY.length > 0;
}

/** Возвращает вектор или null при ошибке/отсутствии ключа. */
export async function embed(text: string): Promise<number[] | null> {
  if (!GEMINI_KEY || !text.trim()) return null;
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
    const model = genAI.getGenerativeModel({ model: EMBED_MODEL });
    const res = await model.embedContent(text.slice(0, 8000));
    const values = res.embedding?.values;
    return Array.isArray(values) && values.length ? values : null;
  } catch {
    return null;
  }
}

export function cosine(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function parseEmbedding(raw: string | null): number[] | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}
