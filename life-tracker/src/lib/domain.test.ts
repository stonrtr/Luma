import { describe, it, expect } from "vitest";
import {
  TASK_STATUSES, TASK_STATUS_LABEL, PRIORITY_VALUES, DEFAULT_PRIORITY,
  priorityTone, plannedLabel,
} from "./domain";

describe("priorityTone", () => {
  it("maps priority ranges to restyle tones", () => {
    // high (>=7) — оранжевый, mid (>=5) — зелёный, low — серый
    expect(priorityTone(10)).toBe("#C25A28");
    expect(priorityTone(7)).toBe("#C25A28");
    expect(priorityTone(6)).toBe("#3D6B26");
    expect(priorityTone(5)).toBe("#3D6B26");
    expect(priorityTone(4)).toBe("#94A18F");
    expect(priorityTone(1)).toBe("#94A18F");
  });
});

describe("plannedLabel", () => {
  it("formats minutes and hours", () => {
    expect(plannedLabel(15)).toBe("15хв");
    expect(plannedLabel(30)).toBe("30хв");
    expect(plannedLabel(60)).toBe("1год");
    expect(plannedLabel(120)).toBe("2год");
    expect(plannedLabel(90)).toBe("1.5год");
  });
});

describe("constants", () => {
  it("has 5 statuses each with a label", () => {
    expect(TASK_STATUSES).toHaveLength(5);
    for (const s of TASK_STATUSES) expect(TASK_STATUS_LABEL[s]).toBeTruthy();
  });
  it("priority values are 1..10 with default 5", () => {
    expect(PRIORITY_VALUES).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(DEFAULT_PRIORITY).toBe(5);
  });
});
