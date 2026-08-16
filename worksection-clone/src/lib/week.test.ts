import { describe, it, expect } from "vitest";
import { mondayUtc, weekStartInTz } from "./week";

describe("mondayUtc — снап к понедельнику 00:00 UTC (без TZ среды)", () => {
  it("пятница → понедельник той же недели", () => {
    expect(mondayUtc(new Date("2026-08-14T10:00:00Z")).toISOString()).toBe("2026-08-10T00:00:00.000Z");
  });
  it("сам понедельник 00:00 UTC — не сдвигается (идемпотентно)", () => {
    const m = new Date("2026-08-10T00:00:00Z");
    expect(mondayUtc(m).toISOString()).toBe("2026-08-10T00:00:00.000Z");
    expect(mondayUtc(mondayUtc(m)).toISOString()).toBe("2026-08-10T00:00:00.000Z");
  });
  it("воскресенье → понедельник ЭТОЙ недели (не следующей)", () => {
    expect(mondayUtc(new Date("2026-08-16T23:00:00Z")).toISOString()).toBe("2026-08-10T00:00:00.000Z");
  });
});

describe("weekStartInTz — неделя по TZ пользователя", () => {
  it("вечер вс в Киеве всё ещё та же неделя (маркер понедельника)", () => {
    // 2026-08-16 22:00 Kyiv = 19:00 UTC, воскресенье → понедельник 10 авг
    expect(weekStartInTz("Europe/Kyiv", new Date("2026-08-16T19:00:00Z")).toISOString()).toBe("2026-08-10T00:00:00.000Z");
  });
  it("пн 01:00 Киев (вс 22:00 UTC) — уже НОВАЯ неделя для киевлянина", () => {
    // 2026-08-17 01:00 Kyiv = 2026-08-16 22:00 UTC. По UTC ещё вс (старая неделя),
    // по Киеву уже пн 17-го → маркер 17 авг. Это и есть «неделя по сотруднику».
    expect(weekStartInTz("Europe/Kyiv", new Date("2026-08-16T22:00:00Z")).toISOString()).toBe("2026-08-17T00:00:00.000Z");
  });
});
