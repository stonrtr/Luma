import { describe, it, expect } from "vitest";
import { zonedDateStr, zonedMinutes } from "./tz";

// 2026-08-08T00:30:00Z — в Киеве (+3 летом) это 03:30 того же дня
const instant = new Date("2026-08-08T00:30:00Z");

describe("zonedDateStr", () => {
  it("formats the date in the given timezone", () => {
    expect(zonedDateStr(instant, "UTC")).toBe("2026-08-08");
    expect(zonedDateStr(instant, "Europe/Kyiv")).toBe("2026-08-08");
    // в Лос-Анджелесе (-7) это ещё 2026-08-07 17:30
    expect(zonedDateStr(instant, "America/Los_Angeles")).toBe("2026-08-07");
  });
});

describe("zonedMinutes", () => {
  it("returns minutes-of-day in the given timezone", () => {
    expect(zonedMinutes(instant, "UTC")).toBe(30); // 00:30
    expect(zonedMinutes(instant, "Europe/Kyiv")).toBe(3 * 60 + 30); // 03:30
  });
});

import { zonedTimeToUtc } from "./tz";

describe("zonedTimeToUtc", () => {
  it("конвертирует киевское стенное время в UTC (летнее время, +3)", () => {
    const d = zonedTimeToUtc("2026-08-14", "15:30", "Europe/Kyiv");
    expect(d.toISOString()).toBe("2026-08-14T12:30:00.000Z");
  });
  it("конвертирует зимнее время (+2)", () => {
    const d = zonedTimeToUtc("2026-01-15", "09:00", "Europe/Kyiv");
    expect(d.toISOString()).toBe("2026-01-15T07:00:00.000Z");
  });
  it("дата без времени — полночь пользователя", () => {
    const d = zonedTimeToUtc("2026-08-14", "00:00", "Europe/Kyiv");
    expect(d.toISOString()).toBe("2026-08-13T21:00:00.000Z");
  });
});
