import { describe, it, expect } from "vitest";
import { mondayOf, addDays, isoWeekNumber, monthLabel } from "./week";

describe("mondayOf", () => {
  it("returns the Monday of the week at midnight", () => {
    for (let i = 0; i < 14; i++) {
      const d = addDays(new Date(2026, 7, 1), i); // разные дни
      const m = mondayOf(d);
      expect(m.getDay()).toBe(1); // Monday
      expect(m.getHours()).toBe(0);
      expect(m.getTime()).toBeLessThanOrEqual(new Date(d).setHours(0, 0, 0, 0));
      expect(new Date(d).setHours(0, 0, 0, 0) - m.getTime()).toBeLessThan(7 * 86400000);
    }
  });
});

describe("addDays", () => {
  it("adds and subtracts days", () => {
    const base = new Date(2026, 0, 10);
    expect(addDays(base, 5).getDate()).toBe(15);
    expect(addDays(base, -3).getDate()).toBe(7);
  });
});

describe("isoWeekNumber", () => {
  it("Jan 4 is always ISO week 1", () => {
    expect(isoWeekNumber(new Date(2026, 0, 4))).toBe(1);
    expect(isoWeekNumber(new Date(2024, 0, 4))).toBe(1);
  });
  it("returns a value in 1..53", () => {
    const n = isoWeekNumber(new Date(2026, 6, 15));
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(53);
  });
});

describe("monthLabel", () => {
  it("maps month index to Ukrainian name", () => {
    expect(monthLabel(0)).toBe("Січень");
    expect(monthLabel(7)).toBe("Серпень");
    expect(monthLabel(11)).toBe("Грудень");
  });
});
