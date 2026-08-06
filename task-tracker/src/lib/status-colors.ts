import type { TaskStatus } from "@/generated/prisma/client";

export const statusColors: Record<TaskStatus, { swatch: string; tint: string }> = {
  IDEA: { swatch: "bg-indigo-300", tint: "bg-indigo-50" },
  TODO: { swatch: "bg-sky-300", tint: "bg-sky-50" },
  IN_PROGRESS: { swatch: "bg-emerald-500", tint: "bg-emerald-50" },
  TO_APPROVE: { swatch: "bg-rose-300", tint: "bg-rose-50" },
  DONE: { swatch: "bg-slate-500", tint: "bg-slate-50" },
  PAUSED: { swatch: "bg-gray-400", tint: "bg-gray-50" },
};

/** Green (1) → yellow → orange → red (10). */
export function priorityColor(value: number) {
  const clamped = Math.min(10, Math.max(1, value));
  const t = (clamped - 1) / 9;
  const hue = 120 - t * 120;
  return `hsl(${hue.toFixed(0)} 70% 45%)`;
}
