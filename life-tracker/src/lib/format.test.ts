import { describe, it, expect } from "vitest";
import { formatMinutes, initials, isOverdue, formatMoney } from "./format";

describe("formatMinutes", () => {
  it("formats minutes, hours and both (default uk units)", () => {
    expect(formatMinutes(0)).toBe("0хв");
    expect(formatMinutes(45)).toBe("45хв");
    expect(formatMinutes(60)).toBe("1год");
    expect(formatMinutes(90)).toBe("1год 30хв");
    expect(formatMinutes(480)).toBe("8год");
  });
  it("localizes units by locale", () => {
    expect(formatMinutes(90, "ru")).toBe("1ч 30м");
    expect(formatMinutes(90, "en")).toBe("1h 30m");
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
