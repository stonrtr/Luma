import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseStructuredSummary, parsePlannedMinutes } from "./summary";

describe("parseStructuredSummary", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 8, 10, 0, 0)); // 08.08.2026
  });
  afterEach(() => vi.useRealTimers());

  it("разбирает шаблон пользователя: секции + дедлайн + плановое время + приоритет", () => {
    const summary = [
      "Саммари 21.07",
      "Идеи ",
      "Помыть посуду",
      "Поковырять в носу",
      "",
      "Задачи ",
      "Вытереть пыль. До 21.08. 2 год. 5",
      "Умыться. До 15.08. 30 хв. 8",
    ].join("\n");

    const r = parseStructuredSummary(summary)!;
    expect(r).not.toBeNull();
    expect(r.ideas).toEqual(["Помыть посуду", "Поковырять в носу"]);
    expect(r.tasks).toHaveLength(2);

    expect(r.tasks[0]).toMatchObject({ title: "Вытереть пыль", priority: 5, dueLabel: "21.08.2026", plannedMinutes: 120 });
    expect(r.tasks[1]).toMatchObject({ title: "Умыться", priority: 8, dueLabel: "15.08.2026", plannedMinutes: 30 });
    // дедлайн — 19:00 локального дня
    expect(new Date(r.tasks[0].dueISO!).getHours()).toBe(19);
  });

  it("парсит плановое время в разных форматах", () => {
    expect(parsePlannedMinutes("2 год")).toBe(120);
    expect(parsePlannedMinutes("30 хв")).toBe(30);
    expect(parsePlannedMinutes("1 год 30 хв")).toBe(90);
    expect(parsePlannedMinutes("1.5 год")).toBe(90);
    expect(parsePlannedMinutes("45 хвилин")).toBe(45);
    expect(parsePlannedMinutes("Без оцінки")).toBeNull();
    expect(parsePlannedMinutes("5")).toBeNull();
  });

  it("шапка «Саммари …» до первой секции игнорируется", () => {
    const r = parseStructuredSummary("Саммари 21.07\nЗадачи\nСделать. До 10.09. 3")!;
    expect(r.ideas).toEqual([]);
    expect(r.tasks).toHaveLength(1);
    expect(r.tasks[0].title).toBe("Сделать");
  });

  it("прошедшая дата без года переносится на следующий год", () => {
    const r = parseStructuredSummary("Задачі\nЩось. До 01.02. 4")!; // 01.02 уже прошло в авг 2026
    expect(r.tasks[0].dueLabel).toBe("01.02.2027");
  });

  it("украинские заголовки и маркеры списка", () => {
    const r = parseStructuredSummary("Ідеї\n- Ідея А\n• Ідея Б\nЗадачі\n1. Зробити щось. До 05.12. 9")!;
    expect(r.ideas).toEqual(["Ідея А", "Ідея Б"]);
    expect(r.tasks[0]).toMatchObject({ title: "Зробити щось", priority: 9, dueLabel: "05.12.2026" });
  });

  it("без параметров → priority/dueISO/plannedMinutes = null (спросим в импорте)", () => {
    const r = parseStructuredSummary("Задачи\nПросто задача")!;
    expect(r.tasks[0]).toMatchObject({ title: "Просто задача", priority: null, dueISO: null, dueLabel: null, plannedMinutes: null });
  });

  it("без планового времени → plannedMinutes = null (пример пользователя)", () => {
    const r = parseStructuredSummary("Задачі\nУмыться. До 15.08. 8")!;
    expect(r.tasks[0]).toMatchObject({ title: "Умыться", priority: 8, dueLabel: "15.08.2026", plannedMinutes: null });
  });

  it("свободный текст без секций → null (уйдёт в ИИ)", () => {
    expect(parseStructuredSummary("Обговорили лендінг. Оля підготує макет.")).toBeNull();
  });
});
