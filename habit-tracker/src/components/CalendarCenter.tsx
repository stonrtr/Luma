"use client";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { addDays, mondayOf, startOfMonth, addMonths, monthTitle, WD_SHORT } from "@/lib/date";
import type { Task } from "@/lib/types";

export function CalendarCenter({ onAddForDate }: { onAddForDate: (date: string) => void }) {
  const { state, toggleTask } = useStore();
  const [anchor, setAnchor] = useState(() => startOfMonth(state.today));

  const monthMM = anchor.slice(0, 7); // YYYY-MM
  const gridStart = mondayOf(anchor);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  const byDate = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of state.tasks) {
      if (!t.dueDate) continue;
      const arr = m.get(t.dueDate) ?? [];
      arr.push(t);
      m.set(t.dueDate, arr);
    }
    return m;
  }, [state.tasks]);

  return (
    <>
      <div className="head">
        <h1 style={{ textTransform: "capitalize" }}>{monthTitle(anchor)}</h1>
        <div className="cal-nav">
          <button onClick={() => setAnchor((a) => addMonths(a, -1))} aria-label="Прошлый месяц">‹</button>
          <button className="cal-today" onClick={() => setAnchor(startOfMonth(state.today))}>сегодня</button>
          <button onClick={() => setAnchor((a) => addMonths(a, 1))} aria-label="Следующий месяц">›</button>
        </div>
      </div>

      <div className="cal-wd">
        {WD_SHORT.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="cal-grid">
        {cells.map((date) => {
          const inMonth = date.slice(0, 7) === monthMM;
          const isToday = date === state.today;
          const items = (byDate.get(date) ?? []).sort((a, b) => (a.doneAt ? 1 : 0) - (b.doneAt ? 1 : 0) || a.ord - b.ord);
          return (
            <div
              className={`cal-cell${inMonth ? "" : " out"}${isToday ? " today" : ""}`}
              key={date}
              onClick={() => onAddForDate(date)}
              title="Добавить задачу на этот день"
            >
              <div className="cal-daynum">{Number(date.slice(8, 10))}</div>
              {items.slice(0, 4).map((t) => (
                <button
                  key={t.id}
                  className={`cal-task${t.doneAt ? " done" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTask(t.id, !t.doneAt);
                  }}
                  title={t.title}
                >
                  {t.title}
                </button>
              ))}
              {items.length > 4 && <div className="cal-more">+{items.length - 4}</div>}
            </div>
          );
        })}
      </div>

      <div className="muted-note" style={{ marginTop: 14 }}>
        Клик по дню — добавить задачу на эту дату. Клик по задаче — отметить выполненной. Привычки в календарь не попадают.
      </div>
    </>
  );
}
