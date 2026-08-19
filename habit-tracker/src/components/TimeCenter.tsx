"use client";
import { useStore } from "@/lib/store";
import { horizonTasks, type Horizon } from "@/lib/selectors";
import { humanFull } from "@/lib/date";
import type { Task } from "@/lib/types";
import { Tick } from "./icons";

const TITLES: Record<Horizon, string> = {
  week: "На этой неделе",
  month: "В этом месяце",
  future: "Будущее",
};

export function TimeCenter({ horizon, onOpenTask }: { horizon: Horizon; onOpenTask: (id: string) => void }) {
  const { state, toggleTask } = useStore();
  const tasks = horizonTasks(state, horizon, true);
  const openCount = tasks.filter((t) => !t.doneAt).length;

  const goalName = (goalId: string | null) =>
    goalId ? state.goals.find((g) => g.id === goalId)?.name ?? null : null;

  // группировка по дате
  const groups: { date: string; items: Task[] }[] = [];
  for (const t of tasks) {
    const last = groups[groups.length - 1];
    if (last && last.date === t.dueDate) last.items.push(t);
    else groups.push({ date: t.dueDate!, items: [t] });
  }

  return (
    <>
      <div className="head">
        <h1>{TITLES[horizon]}</h1>
        <div className="left">{openCount ? `${openCount} задач` : "всё закрыто"}</div>
      </div>

      {groups.length === 0 ? (
        <div className="empty">
          <b>Здесь пусто</b>
          Нет задач в этом окне.
        </div>
      ) : (
        groups.map((g) => (
          <div className="tgroup" key={g.date}>
            <div className="tgroup-h">{humanFull(g.date)}</div>
            <div className="list">
              {g.items.map((t) => {
                const gn = goalName(t.goalId);
                return (
                  <div className={`item${t.doneAt ? " done" : ""}`} key={t.id}>
                    <button className="box" onClick={() => toggleTask(t.id, !t.doneAt)} aria-label={t.title}>
                      <Tick />
                    </button>
                    <button className="lab lab-btn" onClick={() => onOpenTask(t.id)}>{t.title}</button>
                    {gn ? <span className="tag">{gn}</span> : <span className="tag inbox">инбокс</span>}
                    <span className="due" />
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </>
  );
}
