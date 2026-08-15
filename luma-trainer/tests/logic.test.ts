import { describe, it, expect } from "vitest";
import { normalize, detectLanguage } from "../lib/lang";
import { parseImport, parseImportLine } from "../lib/importParser";
import { estimateDifficulty } from "../lib/difficulty";
import { maskAnswer, hintLetterCount, isFullyRevealed } from "../lib/hint";
import { checkAnswer } from "../lib/answerCheck";
import { review, computeProgress, DEFAULT_SRS_SETTINGS, type SrsState } from "../lib/srs";
import type { Rating } from "../lib/types";

const newState = (over: Partial<SrsState> = {}): SrsState => ({
  stability: 0,
  difficulty: 5,
  reviewCount: 0,
  successfulReviewCount: 0,
  consecutiveCorrect: 0,
  lapseCount: 0,
  hintCount: 0,
  lastRating: null,
  lastReviewedAt: null,
  dueAt: null,
  ...over,
});

describe("normalize", () => {
  it("collapses whitespace and trims", () => {
    expect(normalize("  a   significant\tachievement  ")).toBe("a significant achievement");
  });
});

describe("detectLanguage", () => {
  it("detects English vs Russian", () => {
    expect(detectLanguage("hello world")).toBe("en");
    expect(detectLanguage("привет мир")).toBe("ru");
  });
});

describe("parseImport", () => {
  it("parses em-dash, semicolon and tab separators", () => {
    expect(parseImportLine("break the ice — растопить лёд")).toMatchObject({ english: "break the ice", russian: "растопить лёд" });
    expect(parseImportLine("piece of cake; проще простого")).toMatchObject({ english: "piece of cake", russian: "проще простого" });
    expect(parseImportLine("to meet\tуложиться")).toMatchObject({ english: "to meet", russian: "уложиться" });
  });
  it("does NOT split on commas", () => {
    const e = parseImportLine("well, actually")!;
    expect(e.english).toBe("well, actually");
    expect(e.russian).toBe("");
  });
  it("handles one-sided lines by language", () => {
    expect(parseImportLine("to get along with")).toMatchObject({ english: "to get along with", russian: "", sourceLanguage: "en" });
    expect(parseImportLine("уйти по-английски")).toMatchObject({ english: "", russian: "уйти по-английски", sourceLanguage: "ru" });
  });
  it("skips blank lines and keeps every real row", () => {
    const r = parseImport("break the ice — растопить лёд\n\nby the way\n");
    expect(r.entries.length).toBe(2);
  });
});

describe("estimateDifficulty", () => {
  it("is not a flat 5 and scales with complexity", () => {
    const easy = estimateDifficulty("cat");
    const hard = estimateDifficulty("a comprehensive institutional transformation");
    expect(easy).toBeLessThan(hard);
    expect(hard).toBeGreaterThanOrEqual(5);
  });
});

describe("hint", () => {
  it("reveals one letter at a time, preserving spaces/punctuation", () => {
    const ans = "растопить лёд";
    expect(hintLetterCount(ans)).toBe(12); // letters only (растопить=9 + лёд=3)
    expect(maskAnswer(ans, 0)).toBe("••••••••• •••");
    expect(maskAnswer(ans, 1)).toBe("р•••••••• •••");
    expect(maskAnswer(ans, 2)).toBe("ра••••••• •••");
    expect(isFullyRevealed(ans, 11)).toBe(false);
    expect(isFullyRevealed(ans, 12)).toBe(true);
  });
});

describe("checkAnswer (flexible, §20.4)", () => {
  const answers = ["have already sent", "I have already sent the email"];
  it("accepts the gap fragment", () => expect(checkAnswer("have already sent", answers)).toBe(true));
  it("accepts the full sentence, any case", () => expect(checkAnswer("i have already sent the email", answers)).toBe(true));
  it("accepts contraction/expansion equivalence", () => {
    expect(checkAnswer("I've already sent the email", answers)).toBe(true);
  });
  it("rejects wrong answers", () => expect(checkAnswer("has sent", answers)).toBe(false));
});

describe("SRS — new cards start at 0 (§9.3, §31)", () => {
  it("a brand-new card has progress 0 and known false", () => {
    const { progress, known } = computeProgress(newState(), DEFAULT_SRS_SETTINGS);
    expect(progress).toBe(0);
    expect(known).toBe(false);
  });
  it("'again' on a new card never yields 100 and reschedules ~10 min", () => {
    const out = review(newState(), "again");
    expect(out.progress).toBeLessThan(100);
    expect(out.known).toBe(false);
    expect(out.consecutiveCorrect).toBe(0);
    expect(out.lapseCount).toBe(1);
    expect(out.intervalDays).toBeLessThan(0.02); // < ~30 min
  });
  it("'easy' grows the interval and streak", () => {
    const out = review(newState(), "easy");
    expect(out.consecutiveCorrect).toBe(1);
    expect(out.intervalDays).toBeGreaterThan(1);
    expect(out.progress).toBeGreaterThan(0);
  });
});

describe("SRS — known transition (§9.4)", () => {
  it("reaches known only after criteria are met", () => {
    let s = newState();
    const grade = (r: Rating) => {
      const o = review(s, r);
      s = { ...s, stability: o.stability, difficulty: o.difficulty, reviewCount: o.reviewCount, successfulReviewCount: o.successfulReviewCount, consecutiveCorrect: o.consecutiveCorrect, lapseCount: o.lapseCount, lastRating: o.lastRating, lastReviewedAt: o.lastReviewedAt, dueAt: o.dueAt };
      return o;
    };
    // Simulate spaced successful reviews with elapsed time so stability compounds.
    let last = grade("easy");
    for (let i = 0; i < 6; i++) {
      // advance clock to the due date so retrievability logic runs naturally
      s.lastReviewedAt = new Date(Date.now() - (last.intervalDays + 1) * 86400000);
      last = grade("easy");
    }
    expect(last.successfulReviewCount).toBeGreaterThanOrEqual(DEFAULT_SRS_SETTINGS.requiredSuccess);
    expect(last.stability).toBeGreaterThanOrEqual(DEFAULT_SRS_SETTINGS.minIntervalDays);
    expect(last.known).toBe(true);
    expect(last.progress).toBe(100);
  });

  it("an 'again' after being known drops it below 100", () => {
    const known = newState({ stability: 30, successfulReviewCount: 5, consecutiveCorrect: 5, reviewCount: 5, lastRating: "easy", lastReviewedAt: new Date() });
    const out = review(known, "again");
    expect(out.known).toBe(false);
    expect(out.progress).toBeLessThan(100);
  });
});
