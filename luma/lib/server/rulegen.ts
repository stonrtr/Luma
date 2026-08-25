// Grammar rule generation via the LLM cascade (§20).
import "server-only";
import { askJson } from "./llm";
import { normalize } from "../lang";

export interface GeneratedRule {
  title: string;
  explanation: string;
  formula: string;
  uses: string[];
  examples: { en: string; ru: string }[];
  markers: string[];
  mistakes: string[];
  comparison: string;
  exercises: {
    type: "choice" | "fill" | "fix" | "order" | "translate" | "identify";
    prompt: string;
    answers: string[];
    options: string[];
    explanation: string;
  }[];
}

const SYSTEM = `You are an English grammar tutor for Russian-speaking learners.
Given a topic or question (e.g. "Present Perfect", "разница между say и tell"), produce a structured lesson as STRICT JSON and nothing else.

The JSON must have keys:
- "title": concise lesson title.
- "explanation": 2–4 sentences in Russian, clear, non-repetitive.
- "formula": the structural formula (e.g. "have/has + V3").
- "uses": array of 2–5 short Russian strings describing when to use it.
- "examples": array of 3–5 objects {en, ru} — natural English sentences with Russian translations.
- "markers": array of typical marker words / signal words (strings).
- "mistakes": array of 2–4 common mistakes Russian speakers make (Russian strings).
- "comparison": 1–2 sentences comparing with a similar construction (Russian). May be "".
- "exercises": array of 4–6 interactive exercises. Each: {type, prompt, answers, options, explanation}.
   type ∈ "choice" | "fill" | "fix" | "order" | "translate" | "identify".
   - "choice": prompt is the sentence with a blank/question; "options" holds 3–4 choices; "answers" holds the correct option(s).
   - "fill": prompt has a gap like "I ___ (see) him."; "answers" lists acceptable fillers AND/OR full correct sentences.
   - "fix": prompt is an incorrect sentence; "answers" is the corrected sentence.
   - "order": prompt is the target meaning (Russian); "options" holds the scrambled words; "answers" the correct sentence.
   - "translate": prompt is a Russian sentence; "answers" acceptable English translations.
   - "identify": prompt is a sentence; "options" hold labels; "answers" the correct label.
   Always give "explanation" (Russian) for each exercise. Use [] for unused option fields.
Context requirement: set ALL example sentences and ALL exercise sentences in BUSINESS, NEGOTIATIONS or MARKETING situations — but avoid clichéd stock sentences ("launch a campaign", "increase sales", "our sales grew"). Prefer specific, lived-in scenes: a client asking for a discount, a partner missing a deadline, disagreeing with a designer over a new logo, a difficult conversation about a raise, a presentation that went wrong, a customer complaint that turned into a sale. IMPORTANT: use plain everyday business language — no dense industry jargon or abbreviations (avoid SLA, RFP, KPI, net-60, churn-type vocabulary). The sentences must be instantly understandable without a procurement dictionary. Vary the scenarios across examples. Keep grammar demonstrations natural — never distort the rule to force the setting.
Do not output one long repeated paragraph.`;

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean);
}

function validate(obj: unknown): GeneratedRule | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  const title = typeof o.title === "string" ? normalize(o.title) : "";
  const explanation = typeof o.explanation === "string" ? o.explanation.trim() : "";
  if (!explanation) return null;

  const examplesRaw = Array.isArray(o.examples) ? o.examples : [];
  const examples = examplesRaw
    .map((e) => {
      const eo = (e || {}) as Record<string, unknown>;
      return {
        en: typeof eo.en === "string" ? eo.en.trim() : "",
        ru: typeof eo.ru === "string" ? eo.ru.trim() : "",
      };
    })
    .filter((e) => e.en || e.ru);

  const exercisesRaw = Array.isArray(o.exercises) ? o.exercises : [];
  const allowed = ["choice", "fill", "fix", "order", "translate", "identify"];
  const exercises = exercisesRaw
    .map((x) => {
      const xo = (x || {}) as Record<string, unknown>;
      const type = typeof xo.type === "string" && allowed.includes(xo.type) ? xo.type : "fill";
      return {
        type: type as GeneratedRule["exercises"][number]["type"],
        prompt: typeof xo.prompt === "string" ? xo.prompt.trim() : "",
        answers: asStringArray(xo.answers),
        options: asStringArray(xo.options),
        explanation: typeof xo.explanation === "string" ? xo.explanation.trim() : "",
      };
    })
    .filter((x) => x.prompt && x.answers.length > 0);

  return {
    title,
    explanation,
    formula: typeof o.formula === "string" ? o.formula.trim() : "",
    uses: asStringArray(o.uses),
    examples,
    markers: asStringArray(o.markers),
    mistakes: asStringArray(o.mistakes),
    comparison: typeof o.comparison === "string" ? o.comparison.trim() : "",
    exercises,
  };
}

export async function generateRule(query: string): Promise<GeneratedRule> {
  const { result } = await askJson<GeneratedRule>(SYSTEM, `Topic: ${query}`, validate);
  if (!result.title) result.title = query;
  return result;
}
