"use client";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { indexEntries, goalMomentum, streak } from "@/lib/progress";
import { MomentumTag, ActivityStrip } from "./Momentum";
import { humanFull } from "@/lib/date";
import { Tick } from "./icons";

export function GoalCenter({ goalId, onAddHabit }: { goalId: string; onAddHabit: (goalId: string) => void }) {
  const { state, toggleTask, addTask, setGoalStatus } = useStore();
  const idx = useMemo(() => indexEntries(state.entries), [state.entries]);
  const [draft, setDraft] = useState("");

  const goal = state.goals.find((g) => g.id === goalId);
  if (!goal) return null;

  const tasks = state.tasks.filter((t) => t.goalId === goal.id).sort((a, b) => a.ord - b.ord);
  const habits = state.habits.filter((h) => h.goalId === goal.id);
  const m = goalMomentum(goal, state.tasks, state.habits, idx, state.today);
  const openTasks = tasks.filter((t) => !t.doneAt);
  const doneTasks = tasks.filter((t) => t.doneAt);

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    setDraft("");
    addTask(goal.id, title, null);
  };

  return (
    <>
      <div className="head">
        <h1>{goal.name}</h1>
        <div className="left">{goal.status === "done" ? "достигнуто ✓" : goal.type === "achievement" ? "достижение" : "поддержание"}</div>
      </div>

      <div className="goal-top">
        <MomentumTag m={m} />
        <ActivityStrip dots={m.dots} />
        <span className="goal-maint">
          {m.lastActive ? `последнее действие: ${humanFull(m.lastActive).toLowerCase()}` : "пока без активности"}
        </span>
      </div>

      <div className="section-label">Привычки — ведут к цели</div>
      {habits.length === 0 ? (
        <div className="muted-note">Нет привычек. Добавь ту, что двигает цель.</div>
      ) : (
        <div className="goal-habits">
          {habits.map((h) => {
            const st = streak(h, idx, state.today);
            return (
              <span className="chip" key={h.id}>
                {h.name}
                {st.value > 0 && <b className="chip-streak"> 🔥{st.value}</b>}
              </span>
            );
          })}
        </div>
      )}
      <button className="mini-btn" style={{ marginTop: 10 }} onClick={() => onAddHabit(goal.id)}>
        + привычка
      </button>

      <div className="section-label">Задачи — {openTasks.length}{doneTasks.length ? ` (+${doneTasks.length} закрыто)` : ""}</div>
      <div className="list">
        {openTasks.concat(doneTasks).map((t) => (
          <div className={`item${t.doneAt ? " done" : ""}`} key={t.id}>
            <button className="box" onClick={() => toggleTask(t.id, !t.doneAt)} aria-label={t.title}>
              <Tick />
            </button>
            <span className="lab">{t.title}</span>
            <span className="due">{t.dueDate ? t.dueDate.slice(5) : ""}</span>
          </div>
        ))}
        {tasks.length === 0 && <div className="muted-note" style={{ padding: "14px 2px" }}>Задач пока нет.</div>}
      </div>
      <div className="goal-add">
        <input placeholder="Новая задача…" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="mini-btn" onClick={add}>+ задача</button>
      </div>

      {goal.status === "done" ? (
        <button className="mini-btn" style={{ marginTop: 22 }} onClick={() => setGoalStatus(goal.id, "active")}>
          вернуть в активные
        </button>
      ) : goal.type === "achievement" ? (
        <button className="mini-btn" style={{ marginTop: 22 }} onClick={() => setGoalStatus(goal.id, "done")}>
          завершить цель
        </button>
      ) : (
        <button className="mini-btn" style={{ marginTop: 22 }} onClick={() => setGoalStatus(goal.id, "done")}>
          отметить достигнутой
        </button>
      )}
    </>
  );
}
