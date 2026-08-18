"use client";
import { t } from "@/lib/i18n";

import Link from "next/link";
import { useMemo } from "react";
import type { TaskStatus } from "@/generated/prisma/enums";
import { TASK_STATUS_LABEL } from "@/lib/domain";
import { cn } from "@/lib/utils";

export type GanttTask = {
  id: string;
  title: string;
  status: TaskStatus;
  startDate: string | null;
  dueDate: string | null;
  assignees: string[];
};
export type GanttDep = { predecessorId: string; successorId: string };
export type GanttMilestone = { id: string; title: string; dueDate: string | null };

const DAY = 28; // ширина дня, px
const ROW = 44;
const LABEL_W = 240;
const HEADER_H = 48;

const BAR_COLOR: Record<TaskStatus, string> = {
  IDEA: "#8E7BD6",
  TODO: "#7E8C79",
  IN_PROGRESS: "#5AA9C9",
  TO_REVIEW: "#D8B25E",
  DONE: "#C6E89B",
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function daysBetween(a: Date, b: Date) {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const GANTT_BCP: Record<string, string> = { uk: "uk-UA", ru: "ru-RU", en: "en-US" };
function monthShort(idx: number, locale: string): string {
  return new Date(2020, ((idx % 12) + 12) % 12, 1).toLocaleDateString(GANTT_BCP[locale] ?? "uk-UA", { month: "short" });
}

export function GanttChart({
  tasks,
  deps,
  milestones,
  locale = "uk",
}: {
  tasks: GanttTask[];
  deps: GanttDep[];
  milestones: GanttMilestone[];
  locale?: string;
}) {
  const model = useMemo(() => {
    const dates: Date[] = [];
    for (const t of tasks) {
      if (t.startDate) dates.push(new Date(t.startDate));
      if (t.dueDate) dates.push(new Date(t.dueDate));
    }
    for (const m of milestones) if (m.dueDate) dates.push(new Date(m.dueDate));
    dates.push(new Date());
    if (dates.length === 0) dates.push(new Date());

    let min = dates[0];
    let max = dates[0];
    for (const d of dates) {
      if (d < min) min = d;
      if (d > max) max = d;
    }
    const rangeStart = addDays(startOfDay(min), -2);
    const rangeEnd = addDays(startOfDay(max), 2);
    const totalDays = Math.max(1, daysBetween(rangeStart, rangeEnd) + 1);

    function span(startISO: string | null, dueISO: string | null) {
      const s = startISO ? new Date(startISO) : dueISO ? new Date(dueISO) : rangeStart;
      const e = dueISO ? new Date(dueISO) : startISO ? new Date(startISO) : addDays(s, 1);
      const x = daysBetween(rangeStart, s) * DAY;
      const w = Math.max(DAY, (daysBetween(s, e) + 1) * DAY);
      return { x, w };
    }

    const rows = tasks.map((t, i) => ({ task: t, y: i * ROW, ...span(t.startDate, t.dueDate) }));
    const rowById = new Map(rows.map((r) => [r.task.id, r]));

    return { rangeStart, totalDays, rows, rowById };
  }, [tasks, milestones]);

  const chartW = model.totalDays * DAY;
  const chartH = model.rows.length * ROW;

  // тики по дням/месяцам
  const ticks = [];
  for (let i = 0; i < model.totalDays; i++) {
    const d = addDays(model.rangeStart, i);
    ticks.push({ i, d, isMonthStart: d.getDate() === 1, isWeekend: d.getDay() === 0 || d.getDay() === 6 });
  }
  const todayX = daysBetween(model.rangeStart, new Date()) * DAY + DAY / 2;

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <div className="flex min-w-max">
        {/* Колонка названий */}
        <div className="sticky left-0 z-10 shrink-0 border-r bg-card" style={{ width: LABEL_W }}>
          <div className="border-b px-3 text-xs font-medium text-muted-foreground" style={{ height: HEADER_H, lineHeight: `${HEADER_H}px` }}>
            {t(locale, "gantt.taskCol")}
          </div>
          {model.rows.map((r) => (
            <Link
              key={r.task.id}
              href={`/tasks/${r.task.id}`}
              className="flex items-center gap-2 border-b px-3 hover:bg-muted/50"
              style={{ height: ROW }}
            >
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: BAR_COLOR[r.task.status] }} />
              <span className="truncate text-sm">{r.task.title}</span>
            </Link>
          ))}
        </div>

        {/* Область диаграммы */}
        <div className="relative" style={{ width: chartW }}>
          {/* Заголовок с датами */}
          <div className="relative border-b" style={{ height: HEADER_H }}>
            {ticks.map((t) => (
              <div
                key={t.i}
                className={cn(
                  "absolute top-0 h-full border-l text-center",
                  t.isWeekend && "bg-muted/40",
                )}
                style={{ left: t.i * DAY, width: DAY }}
              >
                {t.isMonthStart && (
                  <span className="absolute left-1 top-1 whitespace-nowrap text-[10px] font-medium text-muted-foreground">
                    {monthShort(t.d.getMonth(), locale)}
                  </span>
                )}
                <span className="absolute bottom-1 left-0 right-0 text-[10px] text-muted-foreground">{t.d.getDate()}</span>
              </div>
            ))}
          </div>

          {/* Тело */}
          <div className="relative" style={{ height: chartH }}>
            {/* фоновые полосы выходных */}
            {ticks.map((t) =>
              t.isWeekend ? (
                <div key={t.i} className="absolute top-0 bg-muted/30" style={{ left: t.i * DAY, width: DAY, height: chartH }} />
              ) : null,
            )}
            {/* линии строк */}
            {model.rows.map((r) => (
              <div key={r.task.id} className="absolute left-0 right-0 border-b" style={{ top: r.y + ROW - 1 }} />
            ))}

            {/* линия «сегодня» */}
            {todayX >= 0 && todayX <= chartW && (
              <div className="absolute top-0 z-20 w-px" style={{ left: todayX, height: chartH, backgroundColor: "rgba(178,66,57,.7)" }}>
                <span className="absolute -top-0 left-1 text-[9px] font-medium" style={{ color: "rgba(178,66,57,.9)" }}>{t(locale, "gantt.today")}</span>
              </div>
            )}

            {/* стрелки зависимостей */}
            <svg className="pointer-events-none absolute inset-0 z-10" width={chartW} height={chartH}>
              <defs>
                <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" />
                </marker>
              </defs>
              {deps.map((d, idx) => {
                const from = model.rowById.get(d.predecessorId);
                const to = model.rowById.get(d.successorId);
                if (!from || !to) return null;
                const x1 = from.x + from.w;
                const y1 = from.y + ROW / 2;
                const x2 = to.x;
                const y2 = to.y + ROW / 2;
                const midX = Math.max(x1 + 12, x2 - 12);
                return (
                  <path
                    key={idx}
                    d={`M${x1},${y1} H${midX} V${y2} H${x2}`}
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="1.5"
                    markerEnd="url(#arrow)"
                  />
                );
              })}
            </svg>

            {/* бары задач */}
            {model.rows.map((r) => (
              <div
                key={r.task.id}
                className="absolute z-10 flex items-center rounded-md px-2 text-[11px] font-medium text-white shadow-sm"
                style={{
                  left: r.x,
                  top: r.y + 8,
                  width: r.w,
                  height: ROW - 16,
                  backgroundColor: BAR_COLOR[r.task.status],
                }}
                title={`${r.task.title} · ${TASK_STATUS_LABEL[r.task.status]}`}
              >
                <span className="truncate">{r.task.assignees.join(", ") || TASK_STATUS_LABEL[r.task.status]}</span>
              </div>
            ))}

            {/* вехи */}
            {milestones.map((m) => {
              if (!m.dueDate) return null;
              const x = daysBetween(model.rangeStart, new Date(m.dueDate)) * DAY + DAY / 2;
              return (
                <div key={m.id} className="absolute top-0 z-20" style={{ left: x, height: chartH }}>
                  <div className="absolute top-0 w-px" style={{ height: chartH, backgroundColor: "rgba(142,123,214,.6)" }} />
                  <div
                    className="absolute -top-0 size-2.5 -translate-x-1/2 rotate-45"
                    style={{ left: 0, backgroundColor: "#8E7BD6" }}
                    title={m.title}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
