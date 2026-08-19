// Server-only LLM helpers. Ключи читаются из server env и не уходят клиенту.
// Каскад: Gemini (основной) → Anthropic (резерв, если задан ключ).
import "server-only";

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODELS = Array.from(
  new Set([
    process.env.GEMINI_MODEL || "gemini-2.5-flash",
    "gemini-2.5-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
  ])
);
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

export function hasGemini(): boolean {
  return GEMINI_KEY.length > 0;
}
export function hasAnthropic(): boolean {
  return ANTHROPIC_KEY.length > 0;
}
export function hasAnyLLM(): boolean {
  return hasGemini() || hasAnthropic();
}

const TIMEOUT_MS = 60000; // конспект длинного видео считается дольше, чем карточка

async function withTimeout<T>(p: Promise<T>): Promise<T> {
  const controller = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("LLM timeout")), TIMEOUT_MS)
  );
  return Promise.race([p, controller]);
}

/** Достаёт первый сбалансированный JSON-объект или массив из текста. */
export function extractJson<T = unknown>(text: string): T | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const objStart = candidate.indexOf("{");
  const arrStart = candidate.indexOf("[");
  let start = -1;
  let open = "{";
  let close = "}";
  if (arrStart !== -1 && (objStart === -1 || arrStart < objStart)) {
    start = arrStart;
    open = "[";
    close = "]";
  } else if (objStart !== -1) {
    start = objStart;
  }
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(candidate.slice(start, i + 1)) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function isRetryableModelError(msg: string): boolean {
  return /429|quota|rate.?limit|exceeded|not found|404|unavailable|overloaded|503|timeout|error fetching|fetch failed|network|econn|socket/i.test(
    msg
  );
}

async function callGemini(system: string, user: string): Promise<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(GEMINI_KEY);
  const errs: string[] = [];
  for (const modelName of GEMINI_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: system,
        generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
      });
      const res = await withTimeout(model.generateContent(user));
      return res.response.text();
    } catch (e) {
      const err = e as Error;
      errs.push(`${modelName}: ${err.message}`);
      if (!isRetryableModelError(err.message)) throw new Error(errs.join(" | "));
    }
  }
  throw new Error(errs.join(" | ") || "gemini: all models failed");
}

async function callAnthropic(system: string, user: string): Promise<string> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: ANTHROPIC_KEY });
  const res = await withTimeout(
    client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 8192,
      temperature: 0.3,
      system,
      messages: [{ role: "user", content: user }],
    })
  );
  const block = res.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

/**
 * Просит у LLM JSON. Пробует Gemini, затем Anthropic. Возвращает первый ответ,
 * который проходит `validate`. Бросает, если все провайдеры упали.
 */
export async function askJson<T>(
  system: string,
  user: string,
  validate: (obj: unknown) => T | null
): Promise<{ result: T; provider: "gemini" | "anthropic" }> {
  const errors: string[] = [];

  for (let pass = 0; pass < 2; pass++) {
    if (pass > 0) await new Promise((r) => setTimeout(r, 1500));

    if (hasGemini()) {
      try {
        const text = await callGemini(system, user);
        const parsed = extractJson(text);
        const valid = parsed ? validate(parsed) : null;
        if (valid) return { result: valid, provider: "gemini" };
        errors.push("gemini: invalid JSON shape");
      } catch (e) {
        errors.push(`gemini: ${(e as Error).message}`);
      }
    }

    if (hasAnthropic()) {
      try {
        const text = await callAnthropic(system, user);
        const parsed = extractJson(text);
        const valid = parsed ? validate(parsed) : null;
        if (valid) return { result: valid, provider: "anthropic" };
        errors.push("anthropic: invalid JSON shape");
      } catch (e) {
        errors.push(`anthropic: ${(e as Error).message}`);
      }
    }
  }

  throw new Error(errors.join(" | ") || "no LLM provider configured");
}

/** Свободный текстовый ответ (без JSON-режима) — для «Спросить базу» и quick-actions. */
export async function askText(system: string, user: string): Promise<string> {
  const errors: string[] = [];
  if (hasGemini()) {
    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(GEMINI_KEY);
      for (const modelName of GEMINI_MODELS) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: system,
            generationConfig: { temperature: 0.4 },
          });
          const res = await withTimeout(model.generateContent(user));
          const t = res.response.text();
          if (t) return t;
        } catch (e) {
          const err = e as Error;
          errors.push(`${modelName}: ${err.message}`);
          if (!isRetryableModelError(err.message)) break;
        }
      }
    } catch (e) {
      errors.push(`gemini: ${(e as Error).message}`);
    }
  }
  if (hasAnthropic()) {
    try {
      const t = await callAnthropic(system, user);
      if (t) return t;
    } catch (e) {
      errors.push(`anthropic: ${(e as Error).message}`);
    }
  }
  throw new Error(errors.join(" | ") || "no LLM provider configured");
}
