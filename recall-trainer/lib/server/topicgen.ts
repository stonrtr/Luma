// Server-only: turn a pasted note (конспект) into a single recall card.
// One topic = one card. The LLM composes a title (if missing), one open recall
// question that forces you to reconstruct the topic from memory, and a short
// checklist of key points a complete answer should cover (for self-grading).
import "server-only";
import { askJson } from "./llm";
import type { GeneratedCard } from "../types";

const SYSTEM = `Ты — помощник для персональной базы знаний с тренировкой памяти.
Пользователь вставляет конспект по одной теме. Твоя задача — превратить его в ОДНУ карточку для припоминания.

Верни СТРОГО JSON:
{
  "title": "короткое название темы (3-7 слов), на языке конспекта",
  "question": "один открытый вопрос, который заставляет вспомнить и пересказать суть темы по памяти",
  "keyPoints": ["3-7 ключевых пунктов, которые должен содержать полный ответ"]
}

Правила:
- Язык title, question и keyPoints — тот же, что у конспекта.
- Вопрос должен покрывать тему целиком ("Расскажи/объясни/перечисли..."), а не одну деталь. Это НЕ тест с вариантами.
- keyPoints — это конкретные факты/шаги/идеи из конспекта своими словами, кратко (по одной строке). Не переписывай текст дословно, выдели суть.
- Не выдумывай факты, которых нет в конспекте.
- Никакого текста вне JSON.`;

function validate(obj: unknown): GeneratedCard | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  const question = typeof o.question === "string" ? o.question.trim() : "";
  if (!question) return null;
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const keyPoints = Array.isArray(o.keyPoints)
    ? o.keyPoints
        .map((k) => (typeof k === "string" ? k.trim() : ""))
        .filter(Boolean)
        .slice(0, 10)
    : [];
  return { title, question, keyPoints };
}

/** Generate a recall card from raw notes. `hintTitle` is used verbatim if provided. */
export async function generateCard(
  sourceText: string,
  hintTitle?: string
): Promise<GeneratedCard> {
  const trimmed = sourceText.trim().slice(0, 12000);
  const user = `Конспект темы:\n"""\n${trimmed}\n"""${
    hintTitle ? `\n\nНазвание темы задано пользователем: "${hintTitle}". Используй его как title.` : ""
  }`;
  const { result } = await askJson<GeneratedCard>(SYSTEM, user, validate);
  return {
    title: (hintTitle?.trim() || result.title || firstLine(trimmed)).slice(0, 200),
    question: result.question,
    keyPoints: result.keyPoints,
  };
}

function firstLine(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "Тема";
  return line.trim().slice(0, 80);
}
