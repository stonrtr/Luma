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
- "exampleEn" / "exampleRu": ONE short, natural sentence using the phrase in its primary sense, and its faithful translation. Never a template like "Use the word X in a conversation".
- Context requirement: set every example in a BUSINESS, NEGOTIATIONS or MARKETING situation — but avoid clichéd stock sentences ("launch a campaign", "increase sales", "our sales grew"). Prefer specific, lived-in scenes: a client asking for a discount, a partner missing a deadline, disagreeing with a designer over a new logo, a difficult conversation about a raise, a presentation that went wrong, a customer complaint that turned into a sale. IMPORTANT: use plain everyday business language — no dense industry jargon or abbreviations (avoid SLA, RFP, KPI, net-60, churn-type vocabulary unless the phrase itself is about that). The sentence must be instantly understandable to a marketer without a procurement dictionary. Keep it natural — the phrase's meaning must not be distorted to force the setting; if the phrase truly cannot fit business context, use the closest professional/workplace situation.
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
