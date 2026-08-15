// Server-only LLM helpers. API keys are read from server env and never sent to
// the client (§17.1, §28). Two providers: Gemini (primary) → Anthropic (fallback).
import "server-only";

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
// Primary model first, then free-tier-friendly fallbacks tried on quota/rate errors.
const GEMINI_MODELS = Array.from(
  new Set([
    process.env.GEMINI_MODEL || "gemini-2.5-flash",
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-2.0-flash",
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

const TIMEOUT_MS = 20000;

async function withTimeout<T>(p: Promise<T>): Promise<T> {
  const controller = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("LLM timeout")), TIMEOUT_MS)
  );
  return Promise.race([p, controller]);
}

/** Extract the first balanced JSON object from a text blob. */
export function extractJson<T = unknown>(text: string): T | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
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
  // Ретраим следующей моделью не только квоты, но и timeout/сетевые сбои:
  // первый запрос после простоя (cold start на Render Free) регулярно
  // падает на уровне fetch, второй проходит.
  return /429|quota|rate.?limit|exceeded|not found|404|unavailable|overloaded|503|timeout|error fetching|fetch failed|network|econn|socket/i.test(
    msg
  );
}

async function callGemini(system: string, user: string): Promise<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(GEMINI_KEY);
  let lastErr: Error | null = null;
  // Try models in order, moving on when one is rate-limited/unavailable.
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
      lastErr = e as Error;
      if (!isRetryableModelError(lastErr.message)) throw lastErr;
    }
  }
  throw lastErr ?? new Error("gemini: all models failed");
}

async function callAnthropic(system: string, user: string): Promise<string> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: ANTHROPIC_KEY });
  const res = await withTimeout(
    client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 2048,
      temperature: 0.3,
      system,
      messages: [{ role: "user", content: user }],
    })
  );
  const block = res.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

/**
 * Ask the LLM for JSON. Tries Gemini, then Anthropic. Returns the first response
 * that parses into a non-null object via `validate`. Throws if all providers fail.
 */
export async function askJson<T>(
  system: string,
  user: string,
  validate: (obj: unknown) => T | null
): Promise<{ result: T; provider: "gemini" | "anthropic" }> {
  const errors: string[] = [];

  // Два прохода: сразу после пробуждения инстанса (cold start Render Free)
  // сеть бывает не готова и ВСЕ модели падают за доли секунды — короткая
  // пауза и повтор каскада спасают первый пользовательский запрос.
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
