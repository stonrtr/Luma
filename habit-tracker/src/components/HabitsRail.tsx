"use client";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { indexEntries, streak } from "@/lib/progress";
import { addDays, wdShort } from "@/lib/date";
import type { Habit } from "@/lib/types";
import { Tick } from "./icons";

export function HabitsRail({ view }: { view: string }) {
  const { state, toggleHabitEntry } = useStore();
  const idx = useMemo(() => indexEntries(state.entries), [state.entries]);

  const isGoalView = state.goals.some((g) => g.id === view);
  const habits = state.habits.filter((h) => (isGoalView ? h.goalId === view : true));
  const goalName = (h: Habit) => state.goals.find((g) => g.id === h.goalId)?.name ?? "";
  const doneToday = (h: Habit) => idx.get(h.id)?.get(state.today) === true;
  const doneCount = habits.filter(doneToday).length;

  return (
    <div className="rail">
      <div className="hbox">
        <div className="hbox-h">
          <b>Привычки</b>
          <i>{habits.length ? `${doneCount} / ${habits.length} сегодня` : "—"}</i>
        </div>

        {habits.length === 0 && (
          <div className="rail-empty">
            {isGoalView
              ? "У этой цели нет привычек."
              : "Привычек пока нет. Добавь их внутри цели — они появятся здесь."}
          </div>
        )}

        {habits.map((h) => {
          const st = streak(h, idx, state.today);
          const createdDay = h.createdAt.slice(0, 10);
          return (
            <div className="hab" key={h.id}>
              <div className="hab-n">
                <span>{h.name}</span>
                {!isGoalView && <u>{goalName(h)}</u>}
              </div>
              <div className="days">
                {[-6, -5, -4, -3, -2, -1, 0].map((off) => {
                  const date = addDays(state.today, off);
                  const lab = wdShort(date);
                  const future = off > 0;
                  const beforeCreated = date < createdDay;
                  const done = idx.get(h.id)?.get(date) === true;

                  // прошлое/сегодня: либо галочка, либо крестик (всё кликабельно);
                  // будущее и дни до создания — только план (пунктир, некликабельно)
                  let cls = "cell";
                  let content: React.ReactNode = null;
                  const clickable = !(future || beforeCreated);

                  if (future || beforeCreated) {
                    cls += " fut";
                  } else if (done) {
                    cls += " hit";
                    content = <Tick />;
                  } else {
                    cls += " miss";
                    content = "✕";
                  }

                  return (
                    <div className={`day${off === 0 ? " now" : ""}`} key={off}>
                      <u>{lab}</u>
                      {clickable ? (
                        <button className={cls} onClick={() => toggleHabitEntry(h.id, date)} aria-label={`${h.name} ${lab}`}>
                          {content}
                        </button>
                      ) : (
                        <div className={cls}>{content}</div>
                      )}
                    </div>
                  );
                })}
                <span className="streak">
                  <b>{st.value}</b>
                  <u>{st.unit}</u>
                </span>
              </div>
            </div>
          );
        })}

        <div className="note">
          Последние 7 дней, сегодня — крайний справа. Прошедшие дни можно доотметить. Серия — подряд от сегодня назад.
        </div>
      </div>
    </div>
  );
}
