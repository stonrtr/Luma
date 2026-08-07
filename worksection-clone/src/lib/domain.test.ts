import { describe, it, expect } from "vitest";
import {
  TASK_STATUSES, TASK_STATUS_LABEL, PRIORITY_VALUES, DEFAULT_PRIORITY,
  priorityStyle, plannedLabel,
} from "./domain";

describe("priorityStyle", () => {
  it("maps priority ranges to colors", () => {
    expect(priorityStyle(10)).toContain("red-600");
    expect(priorityStyle(9)).toContain("red-600");
    expect(priorityStyle(8)).toContain("orange-500");
    expect(priorityStyle(7)).toContain("orange-500");
    expect(priorityStyle(6)).toContain("sky-500");
    expect(priorityStyle(5)).toContain("sky-500");
    expect(priorityStyle(3)).toContain("slate-400");
    expect(priorityStyle(1)).toContain("slate-300");
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
