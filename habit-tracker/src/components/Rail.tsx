"use client";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { indexEntries, goalProgress } from "@/lib/progress";
import { horizonCount } from "@/lib/selectors";

export function Rail({
  view,
  onSelect,
  onAddGoal,
}: {
  view: string;
  onSelect: (v: string) => void;
  onAddGoal: () => void;
}) {
  const { state } = useStore();
  const idx = useMemo(() => indexEntries(state.entries), [state.entries]);

  const goals = state.goals.filter((g) => g.status === "active").sort((a, b) => a.ord - b.ord);
  const doneCount = state.goals.filter((g) => g.status === "done").length;
  const todayLeft = state.tasks.filter((t) => !t.doneAt && t.dueDate === state.today).length;
  const weekLeft = horizonCount(state, "week");
  const monthLeft = horizonCount(state, "month");
  const futureLeft = horizonCount(state, "future");

  const horizon = (id: string, label: string, count: number) => (
    <button className={`nav-item horizon${view === id ? " sel" : ""}`} onClick={() => onSelect(id)}>
      <span className="nav-top">
        <b>{label}</b>
        <i>{count || (id === "today" ? "✓" : "")}</i>
      </span>
    </button>
  );

  return (
    <aside>
      <div className="cap">Цели</div>
      {goals.map((g) => {
        const p = Math.round(goalProgress(g, state.tasks, state.habits, idx, state.today) * 100);
        return (
          <button key={g.id} className={`nav-item${view === g.id ? " sel" : ""}`} onClick={() => onSelect(g.id)}>
            <span className="nav-top">
              <b>{g.name}</b>
              <i>{p}%</i>
            </span>
            <span className="nav-sub">{g.type === "maintenance" ? "поддержание" : "достижение"}</span>
            <span className="track">
              <i style={{ width: `${p}%` }} />
            </span>
          </button>
        );
      })}
      {goals.length === 0 && <div className="rail-empty" style={{ padding: "4px 10px 10px" }}>Пока нет целей.</div>}
      <button className="add" onClick={onAddGoal}>
        + цель
      </button>
      <button className={`nav-item${view === "goals" ? " sel" : ""}`} onClick={() => onSelect("goals")}>
        <span className="nav-top">
          <b>Все цели</b>
          <i>{doneCount ? `✓ ${doneCount}` : ""}</i>
        </span>
      </button>

      <div className="cap" style={{ marginTop: 22 }}>Задачи</div>
      {horizon("today", "Сегодня", todayLeft)}
      {horizon("week", "Неделя", weekLeft)}
      {horizon("month", "Текущий месяц", monthLeft)}
      {horizon("future", "Будущее", futureLeft)}
      <button className={`nav-item horizon${view === "calendar" ? " sel" : ""}`} onClick={() => onSelect("calendar")}>
        <span className="nav-top">
          <b>📅 Календарь</b>
          <i />
        </span>
      </button>
    </aside>
  );
}
