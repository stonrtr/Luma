"use client";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { indexEntries, goalMomentum, streak } from "@/lib/progress";
import { MomentumTag, ActivityStrip, Tally } from "./Momentum";
import { dayMonth, dayMonthFull } from "@/lib/date";
import { goalColor } from "@/lib/goalColor";
import { Tick } from "./icons";

export function GoalCenter({ goalId, onAddHabit, onQuickAdd }: { goalId: string; onAddHabit: (goalId: string) => void; onQuickAdd: () => void }) {
  const { state, toggleTask, setGoalStatus } = useStore();
  const idx = useMemo(() => indexEntries(state.entries), [state.entries]);

  const goal = state.goals.find((g) => g.id === goalId);
  if (!goal) return null;

  const tasks = state.tasks.filter((t) => t.goalId === goal.id).sort((a, b) => a.ord - b.ord);
  const habits = state.habits.filter((h) => h.goalId === goal.id);
  const m = goalMomentum(goal, state.tasks, state.habits, idx, state.today);
  const openTasks = tasks.filter((t) => !t.doneAt);
  const doneTasks = tasks.filter((t) => t.doneAt);

  return (
    <>
      <div className="head">
        <h1>{goal.name}</h1>
      </div>

      <div className="goal-tally">
        <Tally m={m} size="lg" />
      </div>
      <div className="goal-top">
        <MomentumTag m={m} color={goalColor(goal.id, state.goals)} />
        <ActivityStrip dots={m.dots} />
        <span className="goal-maint">
          {m.lastActive ? `Последняя активность: ${dayMonthFull(m.lastActive)}` : "Последняя активность: —"}
        </span>
      </div>

      <div className="section-label">Related habits</div>
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
            <span className="due">{t.dueDate ? dayMonth(t.dueDate) : ""}</span>
          </div>
        ))}
        {tasks.length === 0 && <div className="muted-note" style={{ padding: "14px 2px" }}>Задач пока нет.</div>}
      </div>
      <button className="add-task" onClick={onQuickAdd}>+ задача</button>

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
