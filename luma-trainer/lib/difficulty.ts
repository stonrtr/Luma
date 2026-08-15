// Per-phrase difficulty estimation 1..10 (§10). Heuristic, not a flat 5.

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

const PHRASAL = /\b(give|get|take|put|come|go|look|make|bring|turn|set|break|carry|run|hold|keep|pull|pick|show|work)\s+(up|down|off|out|in|on|over|away|through|around|along|back|apart|by|after)\b/i;
const ABSTRACT_SUFFIX = /\b\w+(tion|ment|ance|ence|ity|ism|ous|ive|ical|ology)\b/i;

export function estimateDifficulty(english: string): number {
  const text = (english || "").trim();
  if (!text) return 5;
  const words = text.split(/\s+/);
  const wc = words.length;

  let score = 1;
  // Length of the phrase.
  score += clamp((wc - 1) * 0.5, 0, 3);
  // Long / likely-rare words.
  const longWords = words.filter((w) => w.replace(/[^A-Za-z]/g, "").length >= 9).length;
  score += clamp(longWords, 0, 2);
  // Phrasal verbs are hard for Russian speakers.
  if (PHRASAL.test(text)) score += 1.5;
  // Abstract / latinate vocabulary.
  if (ABSTRACT_SUFFIX.test(text)) score += 1;
  // Multi-clause punctuation.
  if (/[,;:]/.test(text)) score += 0.5;

  return clamp(Math.round(score), 1, 10);
}

export type DifficultyBand = "green" | "lime" | "orange" | "red";

// Пороги из дизайн-handoff: ≤3 зелёный, ≤5 салатовый, ≤7 оранжевый, иначе красный.
export function difficultyBand(d: number): DifficultyBand {
  if (d <= 3) return "green";
  if (d <= 5) return "lime";
  if (d <= 7) return "orange";
  return "red";
}
