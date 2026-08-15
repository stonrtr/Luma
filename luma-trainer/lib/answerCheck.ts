// Flexible answer checking for rule exercises (§20.4).
// Accepts: the gap fragment or the full sentence; any case; stray outer spaces;
// common contractions; punctuation variants.

/** Canonical form: lowercase, no punctuation, collapsed spaces, contractions expanded. */
export function canonical(text: string): string {
  let s = (text || "").toLowerCase().trim();
  // Normalize contractions to a spaced-out form so "I've" == "I have".
  s = s
    .replace(/n['’]t\b/g, " not")
    .replace(/['’]ve\b/g, " have")
    .replace(/['’]re\b/g, " are")
    .replace(/['’]s\b/g, " is")
    .replace(/['’]m\b/g, " am")
    .replace(/['’]ll\b/g, " will")
    .replace(/['’]d\b/g, " would")
    .replace(/\bcannot\b/g, "can not")
    .replace(/\bwon['’]?t\b/g, "will not");
  // Drop punctuation, collapse whitespace.
  s = s.replace(/[.,!?;:"'’()\-—–]/g, " ").replace(/\s+/g, " ").trim();
  return s;
}

/**
 * Is `input` an acceptable answer? `answers` are the accepted variants
 * (e.g. the gap fragment and/or the full sentence).
 */
export function checkAnswer(input: string, answers: string[]): boolean {
  const c = canonical(input);
  if (!c) return false;
  return answers.some((a) => canonical(a) === c);
}
