import { describe, it, expect } from "vitest";
import { formatMinutes, initials, isOverdue, formatMoney } from "./format";

describe("formatMinutes", () => {
  it("formats minutes, hours and both", () => {
    expect(formatMinutes(0)).toBe("0м");
    expect(formatMinutes(45)).toBe("45м");
    expect(formatMinutes(60)).toBe("1ч");
    expect(formatMinutes(90)).toBe("1ч 30м");
    expect(formatMinutes(480)).toBe("8ч");
  });
});

describe("initials", () => {
  it("takes first letters of up to two words, uppercased", () => {
    expect(initials("Артур Стон")).toBe("АС");
    expect(initials("Анна")).toBe("А");
    expect(initials("a b c")).toBe("AB");
    expect(initials("")).toBe("");
  });
});

describe("isOverdue", () => {
  it("is true only for past dates", () => {
    expect(isOverdue(null)).toBe(false);
    expect(isOverdue(undefined)).toBe(false);
    expect(isOverdue(new Date(Date.now() - 60000))).toBe(true);
    expect(isOverdue(new Date(Date.now() + 60000))).toBe(false);
  });
});

describe("formatMoney", () => {
  it("returns a dash for null", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(undefined)).toBe("—");
  });
});
