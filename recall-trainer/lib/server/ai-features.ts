// AI-функции поверх LLM-каскада: быстрые действия в редакторе (§10),
// генерация карточек (§26), «Спросить мою базу» (§23), подсказки метаданных (§15),
// проверка знаний (§29).
import "server-only";
import { askJson, askText } from "./llm";

// ─── Быстрые действия над текстом (§10) ───────────────────────────────────
export type QuickAction =
  | "shorten"
  | "expand"
  | "simplify"
  | "restructure"
  | "highlight"
  | "bulletize";

const ACTION_PROMPT: Record<QuickAction, string> = {
  shorten: "Сделай текст короче, сохранив все ключевые мысли. Убери воду.",
  expand: "Раскрой мысль подробнее, но не добавляй фактов, которых нет в исходном тексте.",
  simplify: "Объясни то же самое проще и понятнее, простыми словами.",
  restructure: "Перепиши структурированно: логично, по абзацам или пунктам.",
  highlight: "Выдели самое главное — оставь только суть, 1–3 предложения.",
  bulletize: "Преврати в список из чётких тезисов (каждый с новой строки, начиная с «- »).",
};

export async function runQuickAction(action: QuickAction, text: string): Promise<string> {
  const system = `Ты редактор персональной базы знаний. Работаешь ТОЛЬКО с данным текстом,
не выдумываешь новые факты. Отвечай на языке исходного текста. Верни ТОЛЬКО результат,
без пояснений и кавычек.`;
  const user = `${ACTION_PROMPT[action]}\n\nТекст:\n${text}`;
  const out = await askText(system, user);
  return out.trim();
}

// ─── Генерация карточки (§26) ─────────────────────────────────────────────
export async function generateCard(
  title: string,
  content: string,
  keyPoints: string[]
): Promise<{ question: string; answer: string }> {
  const system = `Ты создаёшь карточку для интервального повторения из знания пользователя.
Один вопрос на припоминание сути + краткий эталонный ответ. Вопрос — на языке знания.
Формат JSON: {"question": "...", "answer": "..."}`;
  const user = `Знание: "${title}"
Содержание: ${content}
Ключевые тезисы: ${keyPoints.join("; ")}`;
  const { result } = await askJson(system, user, (obj) => {
    const o = obj as { question?: unknown; answer?: unknown };
    if (typeof o?.question === "string" && typeof o?.answer === "string" && o.question.trim()) {
      return { question: o.question.trim(), answer: o.answer.trim() };
    }
    return null;
  });
  return result;
}

// ─── Подсказка метаданных для ручного знания (§15) ────────────────────────
export async function suggestMeta(
  title: string,
  content: string
): Promise<{ title: string; topic: string; tags: string[] }> {
  const system = `Проанализируй заметку пользователя и предложи метаданные.
Формат JSON: {"title": "короткое название", "topic": "Тема → Подтема", "tags": ["3-6 тегов"]}`;
  const user = `${title ? `Название: ${title}\n` : ""}Текст: ${content}`;
  const { result } = await askJson(system, user, (obj) => {
    const o = obj as { title?: unknown; topic?: unknown; tags?: unknown };
    return {
      title: typeof o?.title === "string" ? o.title.trim() : title,
      topic: typeof o?.topic === "string" ? o.topic.trim() : "",
      tags: Array.isArray(o?.tags) ? o.tags.map((t) => String(t).trim()).filter(Boolean) : [],
    };
  });
  return result;
}

// ─── «Спросить мою базу» (§23, §24) ───────────────────────────────────────
export type AskContext = { id: string; title: string; content: string; source: string | null };

export async function askMyBase(
  question: string,
  contexts: AskContext[],
  allowExternal: boolean
): Promise<string> {
  const knowledge = contexts
    .map(
      (c, i) =>
        `[${i + 1}] ${c.title}${c.source ? ` (источник: ${c.source})` : ""}\n${c.content}`
    )
    .join("\n\n");

  const system = allowExternal
    ? `Ты отвечаешь на вопрос пользователя, опираясь ПРЕЖДЕ ВСЕГО на его сохранённые знания.
Если добавляешь внешнюю информацию модели — явно помечай её «(дополнение AI)».
Ссылайся на знания номерами [1], [2] и т.д. Отвечай на языке вопроса.`
    : `Ты отвечаешь на вопрос ТОЛЬКО на основе сохранённых знаний пользователя ниже.
Не добавляй внешнюю информацию. Если в знаниях нет ответа — честно скажи, что в базе этого нет.
Ссылайся на знания номерами [1], [2] и т.д. Отвечай на языке вопроса.`;

  const user = `Вопрос: ${question}

Мои знания:
${knowledge || "(база пуста)"}`;

  return (await askText(system, user)).trim();
}

// ─── Проверка знаний «Проверь меня» (§29) ─────────────────────────────────
export async function generateQuiz(
  topicName: string,
  contexts: AskContext[]
): Promise<{ id: string | null; question: string }[]> {
  const knowledge = contexts
    .map((c) => `[id:${c.id}] ${c.title}: ${c.content}`)
    .join("\n");
  const system = `Составь 3–6 вопросов на припоминание СТРОГО по сохранённым знаниям пользователя.
Вопросы открытые (пользователь отвечает своими словами). Для каждого укажи id связанного знания.
Формат JSON: {"questions": [{"id": "id знания или null", "question": "..."}]}`;
  const user = `Тема: ${topicName}\nЗнания:\n${knowledge}`;
  const { result } = await askJson(system, user, (obj) => {
    const o = obj as { questions?: unknown };
    if (!Array.isArray(o?.questions)) return null;
    const qs = o.questions
      .map((q) => {
        const qq = q as { id?: unknown; question?: unknown };
        if (typeof qq?.question !== "string" || !qq.question.trim()) return null;
        return { id: typeof qq.id === "string" ? qq.id : null, question: qq.question.trim() };
      })
      .filter((x): x is { id: string | null; question: string } => x !== null);
    return qs.length ? qs : null;
  });
  return result;
}

// Оценка ответа пользователя в «Проверь меня».
export async function gradeAnswer(
  question: string,
  reference: string,
  userAnswer: string
): Promise<{ verdict: "correct" | "partial" | "missed"; feedback: string }> {
  const system = `Оцени ответ пользователя на вопрос, сравнив с эталонным знанием.
verdict: "correct" (вспомнил суть), "partial" (частично), "missed" (не вспомнил/неверно).
Короткий feedback: что верно, что упущено. Формат JSON: {"verdict": "...", "feedback": "..."}`;
  const user = `Вопрос: ${question}\nЭталон: ${reference}\nОтвет пользователя: ${userAnswer}`;
  const { result } = await askJson(system, user, (obj) => {
    const o = obj as { verdict?: unknown; feedback?: unknown };
    const v = o?.verdict;
    const verdict: "correct" | "partial" | "missed" =
      v === "correct" || v === "missed" ? v : "partial";
    return { verdict, feedback: typeof o?.feedback === "string" ? o.feedback : "" };
  });
  return result;
}
