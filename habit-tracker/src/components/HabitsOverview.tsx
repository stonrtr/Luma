"use client";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { indexEntries, streak } from "@/lib/progress";
import { useConfirm } from "./confirm";
import type { Habit } from "@/lib/types";

const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function schedLabel(h: Habit): string {
  const s = h.schedule;
  if (s.type === "daily") return "каждый день";
  if (s.type === "weekly") return `${s.timesPerWeek}× в неделю`;
  return (s.days ?? []).map((d) => WD[d - 1]).join(", ") || "по дням";
}

/** Лучшая серия за всё время — самый длинный ряд подряд идущих дней-отметок. */
function bestStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  let best = 1;
  let run = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1] + "T12:00:00").getTime();
    const cur = new Date(dates[i] + "T12:00:00").getTime();
    const diff = Math.round((cur - prev) / 86400000);
    if (diff === 1) run++;
    else if (diff > 1) run = 1;
    if (run > best) best = run;
  }
  return best;
}

export function HabitsOverview() {
  const { state, archiveHabit, restoreHabit } = useStore();
  const ask = useConfirm();
  const idx = useMemo(() => indexEntries(state.entries), [state.entries]);

  const goalName = (id: string | null) => (id ? state.goals.find((g) => g.id === id)?.name ?? null : null);

  const Row = ({ h, archived }: { h: Habit; archived: boolean }) => {
    const dates = state.entries
      .filter((e) => e.habitId === h.id && e.done)
      .map((e) => e.date)
      .sort();
    const now = streak(h, idx, state.today).value;
    const best = bestStreak(dates);
    const gn = goalName(h.goalId);
    return (
      <div className="hrow">
        <div className="hrow-main">
          <div className="hrow-name">{h.name}</div>
          <div className="hrow-meta">
            {schedLabel(h)}
            {gn ? ` · ${gn}` : ""}
          </div>
        </div>
        {!archived && (
          <div className="hrow-stat">
            <b>{now}</b>
            <u>стрик сейчас</u>
          </div>
        )}
        <div className="hrow-stat">
          <b>{best}</b>
          <u>лучшая серия</u>
        </div>
        <div className="hrow-stat">
          <b>{dates.length}</b>
          <u>отметок</u>
        </div>
        <button
          className="mini-btn"
          onClick={async () => {
            if (archived) restoreHabit(h.id);
            else if (await ask(`Отправить привычку «${h.name}» в архив?`, "В архив")) archiveHabit(h.id);
          }}
        >
          {archived ? "восстановить" : "в архив"}
        </button>
      </div>
    );
  };

  return (
    <>
      <div className="head">
        <h1>Привычки</h1>
        <div className="left">
          {state.habits.length} активных · {state.archivedHabits.length} в архиве
        </div>
      </div>

      <div className="section-label">Текущие</div>
      {state.habits.length === 0 ? (
        <div className="muted-note">Нет активных привычек. Заведи через «+».</div>
      ) : (
        <div className="hlist">
          {state.habits.map((h) => (
            <Row key={h.id} h={h} archived={false} />
          ))}
        </div>
      )}

      <div className="section-label">Архив</div>
      {state.archivedHabits.length === 0 ? (
        <div className="muted-note">Архив пуст.</div>
      ) : (
        <div className="hlist">
          {state.archivedHabits.map((h) => (
            <Row key={h.id} h={h} archived />
          ))}
        </div>
      )}
    </>
  );
}
