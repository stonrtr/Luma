import { describe, it, expect } from "vitest";
import { normalize, detectLanguage } from "../lib/lang";
import { parseImport, parseImportLine } from "../lib/importParser";
import { estimateDifficulty } from "../lib/difficulty";
import { maskAnswer, hintLetterCount, isFullyRevealed } from "../lib/hint";
import { checkAnswer } from "../lib/answerCheck";
import { review, nextProgress, type SrsState } from "../lib/srs";

const newState = (over: Partial<SrsState> = {}): SrsState => ({
  progress: 0,
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

describe("Баллы прогресса (100 = выучено, Легко +25, С трудом +15)", () => {
  it("новая карточка — 0 баллов, не выучена", () => {
    expect(newState().progress).toBe(0);
  });

  it("«Легко» даёт +25 каждый раз: 25 → 50 → 75 → 100 и «выучено»", () => {
    let s = newState();
    const steps: number[] = [];
    for (let i = 0; i < 4; i++) {
      const o = review(s, "easy", { now: new Date(Date.now() + i * 1000) });
      steps.push(o.progress);
      s = { ...s, progress: o.progress, stability: o.stability, reviewCount: o.reviewCount, lastRating: o.lastRating, lastReviewedAt: o.lastReviewedAt };
    }
    expect(steps).toEqual([25, 50, 75, 100]);
  });

  it("«С трудом» даёт +15", () => {
    const o1 = review(newState(), "hard");
    expect(o1.progress).toBe(15);
    const o2 = review(newState({ progress: 90, reviewCount: 4, lastReviewedAt: new Date() }), "hard");
    expect(o2.progress).toBe(100); // 90+15 упирается в потолок 100
    expect(o2.known).toBe(true);
  });

  it("смешанные оценки складываются: Легко+С трудом+Легко = 65", () => {
    let s = newState();
    let o = review(s, "easy"); // 25
    s = { ...s, progress: o.progress, reviewCount: o.reviewCount, lastReviewedAt: o.lastReviewedAt };
    o = review(s, "hard"); // 40
    s = { ...s, progress: o.progress, reviewCount: o.reviewCount, lastReviewedAt: o.lastReviewedAt };
    o = review(s, "easy"); // 65
    expect(o.progress).toBe(65);
  });

  it("«Не вспомнил» обнуляет баллы до 0", () => {
    const mid = newState({ progress: 75, reviewCount: 3, lastRating: "easy", lastReviewedAt: new Date() });
    const out = review(mid, "again");
    expect(out.progress).toBe(0);
    expect(out.known).toBe(false);
    expect(out.intervalDays).toBeLessThan(0.02); // ~10 мин
  });

  it("подсказка приравнивается к «Не вспомнил» — баллы в 0", () => {
    const out = review(newState({ progress: 50, reviewCount: 2, lastReviewedAt: new Date() }), "easy", { usedHint: true });
    expect(out.lastRating).toBe("again");
    expect(out.progress).toBe(0);
    expect(out.intervalDays).toBeLessThan(0.02);
  });

  it("nextProgress — чистая функция баллов", () => {
    expect(nextProgress(0, "easy")).toBe(25);
    expect(nextProgress(50, "hard")).toBe(65);
    expect(nextProgress(90, "easy")).toBe(100);
    expect(nextProgress(80, "again")).toBe(0);
  });

  it("интервал в днях не превышает 365 (расписание отдельно от баллов)", () => {
    const veteran = newState({
      stability: 300,
      successfulReviewCount: 10,
      consecutiveCorrect: 10,
      reviewCount: 10,
      lastRating: "easy",
      lastReviewedAt: new Date(Date.now() - 300 * 86400000),
    });
    const out = review(veteran, "easy");
    expect(out.intervalDays).toBeLessThanOrEqual(365);
    expect(out.stability).toBeLessThanOrEqual(365);
  });
});
