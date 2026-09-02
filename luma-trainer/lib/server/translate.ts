// Translation + example generation via the LLM cascade (§17, §18).
import "server-only";
import { askJson } from "./llm";
import { estimateDifficulty } from "../difficulty";
import { detectLanguage, hasCyrillic, hasLatin, normalize } from "../lang";
import type { TranslationResult } from "../types";

const SYSTEM = `You are a professional English–Russian lexicographer for a vocabulary-learning app.
Given a word, expression, or full phrase, produce a strict JSON object and NOTHING else.

Rules:
- Preserve the source grammatical form. For nouns and noun phrases use the dictionary/nominative form (e.g. "a significant achievement" → "значительное достижение", NOT "значительным достижением") unless the phrase itself is in another case.
- "translations": 3–5 natural Russian translations (if source is English) or English translations (if source is Russian), best first. No transliteration. No definitions. No empty strings.
- "transcription": IPA for the English side, wrapped in slashes. Empty string if not applicable.
- "difficulty": integer 1–10 for a Russian learner.
- "exampleEn" / "exampleRu": ONE VERY SHORT sentence using the phrase in its primary sense, and its faithful translation. Never a template like "Use the word X in a conversation".
- LENGTH IS CRITICAL: the English example must be at most 8 words (ideally 5–7). One clause, no subordinate clauses, no "because/which/that" add-ons. Bad (too long): "Our support team is flooded with complaints because we removed a widely popular feature." Good (short): "It's a widely popular feature." / "The client rejected our first offer." / "Let's revisit this after the call."
- Context requirement: set every example in a BUSINESS, NEGOTIATIONS or MARKETING situation, but keep it a plain, tiny everyday-work line — avoid clichés ("launch a campaign", "increase sales") and dense jargon/abbreviations (SLA, RFP, KPI, net-60, churn). It must be instantly clear to a marketer. Don't distort the phrase's meaning to force the setting; if it truly can't fit business, use the closest simple workplace line.
Return JSON with keys: sourceLanguage, english, translations, transcription, difficulty, exampleEn, exampleRu.`;

interface TranslateInput {
  english?: string;
  russian?: string;
  sourceLanguage?: "en" | "ru";
}

function validate(obj: unknown): TranslationResult | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  const english = typeof o.english === "string" ? normalize(o.english) : "";
  const rawTranslations = Array.isArray(o.translations) ? o.translations : [];
  const translations = rawTranslations
    .filter((t): t is string => typeof t === "string")
    .map(normalize)
    .filter((t) => t.length > 0);
  if (translations.length === 0) return null; // §17.3 never save empty as success

  const sourceLanguage: "en" | "ru" = o.sourceLanguage === "ru" ? "ru" : "en";
  const transcription = typeof o.transcription === "string" ? o.transcription.trim() : "";
  let difficulty = typeof o.difficulty === "number" ? Math.round(o.difficulty) : 0;
  if (!(difficulty >= 1 && difficulty <= 10)) difficulty = estimateDifficulty(english);
  const exampleEn = typeof o.exampleEn === "string" ? normalize(o.exampleEn) : "";
  const exampleRu = typeof o.exampleRu === "string" ? normalize(o.exampleRu) : "";

  return { sourceLanguage, english, translations, transcription, difficulty, exampleEn, exampleRu };
}

/** Guard: a Russian "translation" that is pure Latin is likely a transliteration (§17.3). */
function looksLikeTransliteration(source: string, translation: string): boolean {
  return hasLatin(translation) && !hasCyrillic(translation) && hasLatin(source);
}

export async function translatePhrase(input: TranslateInput): Promise<TranslationResult> {
  const known = input.english || input.russian || "";
  const srcLang =
    input.sourceLanguage || detectLanguage(input.english ? input.english : input.russian || "");

  const user =
    srcLang === "en"
      ? `English phrase: "${input.english || input.russian}". Translate to Russian.`
      : `Russian phrase: "${input.russian || input.english}". Translate to English and set "english" to the English side.`;

  const { result } = await askJson<TranslationResult>(SYSTEM, user, validate);

  // If source was English, make sure english side is populated.
  let english = result.english;
  if (srcLang === "en" && !english && input.english) english = normalize(input.english);

  // §17.3 guard: drop transliterated Russian translations when translating EN→RU.
  let translations = result.translations;
  if (srcLang === "en") {
    translations = translations.filter((t) => !looksLikeTransliteration(known, t));
    if (translations.length === 0) translations = result.translations; // keep something rather than lose the card
  }

  return {
    ...result,
    english: english || (srcLang === "en" ? normalize(input.english || "") : ""),
    translations,
  };
}

// --- Быстрый двунаправленный перевод для Telegram-бота ----------------------
// Минимальный промпт на быстрой модели с коротким таймаутом (обычный
// translatePhrase на flash-latest висит ~30с). Направление — по языку ввода:
// русский → английский, английский → русский.
function fastSystem(target: "English" | "Russian"): string {
  const other = target === "English" ? "Russian" : "English";
  return `You translate a ${other} word or phrase into natural ${target} for a language learner.
Return ONLY a strict JSON object: {"best": "<best ${target} translation>", "alternatives": ["<other good option>", ...]}.
Keep the same grammatical form. "best" is the single best translation. "alternatives": 0–3 more natural options, no duplicates, no empty strings.
CRITICAL: every translation must be FULLY in ${target} — never leave any ${other} word untranslated. No extra keys, no commentary.`;
}

export type FastTranslation = {
  sourceLang: "en" | "ru"; // язык введённого текста
  fixed: string; // введённый текст (известная сторона карточки)
  candidates: string[]; // переводы на другой язык (лучший первым)
};

export async function translateFast(text: string): Promise<FastTranslation> {
  const clean = normalize(text);
  const src: "en" | "ru" = detectLanguage(clean); // язык ввода
  const target = src === "ru" ? "English" : "Russian";
  const targetIsEn = target === "English";
  const { result } = await askJson<string[]>(
    fastSystem(target),
    `${src === "ru" ? "Russian" : "English"}: "${clean}". Translate to ${target} only.`,
    (o): string[] | null => {
      const obj = o as { best?: unknown; alternatives?: unknown };
      const norm = (s: string) => normalize(s);
      const best = typeof obj.best === "string" ? norm(obj.best) : "";
      const alts = Array.isArray(obj.alternatives)
        ? obj.alternatives.filter((x): x is string => typeof x === "string").map(norm)
        : [];
      // Оставляем только варианты на нужном языке: EN — без кириллицы; RU — с кириллицей.
      const okLang = (s: string) => (targetIsEn ? !hasCyrillic(s) : hasCyrillic(s));
      const pool = [best, ...alts].filter((s) => s && okLang(s));
      if (pool.length === 0) return null; // не тот язык — считаем неудачей, ретрай
      return Array.from(new Set(pool)).slice(0, 6);
    },
    { models: ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-flash-latest"], timeoutMs: 12000 }
  );
  return { sourceLang: src, fixed: clean, candidates: result };
}
