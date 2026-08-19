// Ядро AI-обработки (§6, §7, §38, §48): исходный текст → смысловые блоки.
// Работает и для YouTube-транскрипта (с таймкодами), и для произвольного текста.
import "server-only";
import { askJson } from "./llm";
import { parseTimecode, type TranscriptSegment, segmentsToTimedText } from "./youtube";

export type PipelineBlock = {
  title: string;
  summary: string;
  content: string;
  keyPoints: string[];
  terms: string[];
  examples: string[];
  takeaways: string[];
  start: number | null;
  end: number | null;
  suggestedTopic: string | null;
};

const SYSTEM = `Ты — ассистент для персональной базы знаний. Тебе дают исходный материал
(транскрипт видео или текст). Задача: разбить его на СМЫСЛОВЫЕ ТЕМЫ и для каждой сделать конспект.

Жёсткие правила качества:
- НЕ добавляй идей, которых нет в источнике. Не выдумывай факты.
- Сохраняй смысл и аргументы автора, конкретные цифры, факты и важные примеры.
- Убирай речевой мусор и повторы.
- Каждый блок — это ОДНА завершённая тема (не абзац). У длинного материала обычно 3–12 тем.
- Пиши на языке источника.

Формат ответа — строго JSON:
{
  "language": "ru|en|...",
  "blocks": [
    {
      "title": "короткое понятное название темы",
      "summary": "1–3 предложения: о чём этот блок",
      "content": "развёрнутый конспект темы своими словами, 2–6 предложений",
      "keyPoints": ["3–10 ключевых тезисов"],
      "terms": ["важные термины/понятия из блока"],
      "examples": ["примеры из источника, если помогают понять идею"],
      "takeaways": ["практические выводы, опционально"],
      "start": "таймкод начала mm:ss или h:mm:ss (только если в тексте есть [mm:ss] метки, иначе null)",
      "end": "таймкод конца или null",
      "suggestedTopic": "Тема → Подтема (предложи категорию, напр. 'Маркетинг → Branding')"
    }
  ]
}`;

type RawBlock = {
  title?: unknown;
  summary?: unknown;
  content?: unknown;
  keyPoints?: unknown;
  terms?: unknown;
  examples?: unknown;
  takeaways?: unknown;
  start?: unknown;
  end?: unknown;
  suggestedTopic?: unknown;
};

function strArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean).slice(0, 20);
}

function validate(obj: unknown): { blocks: PipelineBlock[]; language: string } | null {
  const o = obj as { blocks?: unknown; language?: unknown };
  if (!o || !Array.isArray(o.blocks)) return null;
  const blocks: PipelineBlock[] = [];
  for (const raw of o.blocks as RawBlock[]) {
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    if (!title) continue;
    blocks.push({
      title,
      summary: typeof raw.summary === "string" ? raw.summary.trim() : "",
      content: typeof raw.content === "string" ? raw.content.trim() : "",
      keyPoints: strArr(raw.keyPoints),
      terms: strArr(raw.terms),
      examples: strArr(raw.examples),
      takeaways: strArr(raw.takeaways),
      start: parseTimecode(raw.start as string | number),
      end: parseTimecode(raw.end as string | number),
      suggestedTopic:
        typeof raw.suggestedTopic === "string" && raw.suggestedTopic.trim()
          ? raw.suggestedTopic.trim()
          : null,
    });
  }
  if (!blocks.length) return null;
  const language = typeof o.language === "string" ? o.language : "ru";
  return { blocks, language };
}

/** Ограничиваем объём, чтобы не упереться в лимиты токенов на очень длинных видео. */
function capText(text: string, maxChars = 90000): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n\n[…транскрипт обрезан по длине…]";
}

/** YouTube: используем таймкоды. */
export async function analyzeYoutube(
  meta: { title: string; author: string | null },
  segments: TranscriptSegment[]
): Promise<{ blocks: PipelineBlock[]; language: string }> {
  const timed = capText(segmentsToTimedText(segments));
  const user = `Видео: "${meta.title}"${meta.author ? ` — канал ${meta.author}` : ""}
Транскрипт с таймкодами:

${timed}`;
  const { result } = await askJson(SYSTEM, user, validate);
  return result;
}

/** Произвольный текст/статья — без таймкодов. */
export async function analyzeText(
  title: string,
  text: string
): Promise<{ blocks: PipelineBlock[]; language: string }> {
  const user = `Материал: "${title}"
Текст:

${capText(text)}`;
  const { result } = await askJson(SYSTEM, user, validate);
  return result;
}
