// Progressive hint (§7). Unified rule: reveal answer one letter at a time,
// left to right across the whole phrase. Spaces and punctuation stay visible.

const IS_LETTER = /[\p{L}\p{N}]/u;

/** Count of revealable characters (letters/digits) in the answer. */
export function hintLetterCount(answer: string): number {
  let n = 0;
  for (const ch of answer) if (IS_LETTER.test(ch)) n += 1;
  return n;
}

/**
 * Mask the answer, revealing the first `revealCount` letters.
 * Hidden letters render as `hiddenChar`; whitespace/punctuation always show.
 */
export function maskAnswer(answer: string, revealCount: number, hiddenChar = "•"): string {
  let shown = 0;
  let out = "";
  for (const ch of answer) {
    if (IS_LETTER.test(ch)) {
      if (shown < revealCount) {
        out += ch;
      } else {
        out += hiddenChar;
      }
      shown += 1;
    } else {
      out += ch;
    }
  }
  return out;
}

export function isFullyRevealed(answer: string, revealCount: number): boolean {
  return revealCount >= hintLetterCount(answer);
}
