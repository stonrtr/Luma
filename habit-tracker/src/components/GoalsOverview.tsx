"use client";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { indexEntries, goalMomentum } from "@/lib/progress";
import { MomentumTag, Tally } from "./Momentum";
import { Tick } from "./icons";

export function GoalsOverview({ onOpenGoal, onAddGoal }: { onOpenGoal: (id: string) => void; onAddGoal: () => void }) {
  const { state, setGoalStatus } = useStore();
  const idx = useMemo(() => indexEntries(state.entries), [state.entries]);

  const active = state.goals.filter((g) => g.status === "active").sort((a, b) => a.ord - b.ord);
  const done = state.goals.filter((g) => g.status === "done").sort((a, b) => a.ord - b.ord);

  return (
    <>
      <div className="head">
        <h1>Цели</h1>
        <div className="left">
          {active.length} активных · {done.length} достигнуто
        </div>
      </div>

      <div className="section-label">Активные</div>
      {active.length === 0 ? (
        <div className="muted-note">Активных целей нет.</div>
      ) : (
        <div className="goal-grid">
          {active.map((g) => {
            const m = goalMomentum(g, state.tasks, state.habits, idx, state.today);
            return (
              <button className="goal-card" key={g.id} onClick={() => onOpenGoal(g.id)}>
                <div className="goal-card-h">
                  <b>{g.name}</b>
                  <MomentumTag m={m} />
                </div>
                <Tally m={m} />
              </button>
            );
          })}
        </div>
      )}
      <button className="mini-btn" style={{ marginTop: 12 }} onClick={onAddGoal}>
        + цель
      </button>

      <div className="section-label">Достигнуто</div>
      {done.length === 0 ? (
        <div className="muted-note">Пока ничего не завершено. Закрытые цели появятся здесь.</div>
      ) : (
        <div className="list">
          {done.map((g) => (
            <div className="item done" key={g.id}>
              <span className="box">
                <Tick />
              </span>
              <span className="lab">{g.name}</span>
              <button className="mini-btn" onClick={() => onOpenGoal(g.id)}>
                открыть
              </button>
              <button className="mini-btn" onClick={() => setGoalStatus(g.id, "active")}>
                вернуть
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
