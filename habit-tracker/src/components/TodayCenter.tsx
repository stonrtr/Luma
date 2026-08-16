"use client";
import { useStore } from "@/lib/store";
import { todayOpenTasks, todayDoneTasks } from "@/lib/selectors";
import { humanFull } from "@/lib/date";
import type { Task } from "@/lib/types";
import { Tick } from "./icons";

export function TodayCenter({ selectedId, onQuickAdd }: { selectedId: string | null; onQuickAdd: () => void }) {
  const { state, toggleTask } = useStore();

  const open = todayOpenTasks(state);
  const done = todayDoneTasks(state);

  const goalName = (goalId: string | null) =>
    goalId ? state.goals.find((g) => g.id === goalId)?.name ?? null : null;

  return (
    <>
      <div className="head">
        <h1>{humanFull(state.today)}</h1>
        <div className="left">{open.length ? `осталось ${open.length}` : "всё закрыто"}</div>
      </div>

      <div className="list">
        {open.length === 0 && done.length === 0 ? (
          <div className="empty">
            <b>На сегодня всё</b>
            Добавь задачу на сегодня — Ctrl/⌘ + N.
          </div>
        ) : (
          open.concat(done).map((t) => (
            <Row
              key={t.id}
              task={t}
              goal={goalName(t.goalId)}
              inbox={t.goalId === null}
              overdue={!t.doneAt && t.dueDate !== null && t.dueDate < state.today}
              selected={t.id === selectedId}
              onToggle={() => toggleTask(t.id, !t.doneAt)}
            />
          ))
        )}
      </div>

      <button className="add-task" onClick={onQuickAdd}>+ задача</button>

      {done.length > 0 && (
        <div className="donebar">Сделано сегодня: {done.length} · зачёркнутые уйдут завтра</div>
      )}
    </>
  );
}

function Row({
  task,
  goal,
  inbox,
  overdue,
  selected,
  onToggle,
}: {
  task: Task;
  goal: string | null;
  inbox: boolean;
  overdue: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`item${task.doneAt ? " done" : ""}${selected ? " sel-row" : ""}`}>
      <button className="box" onClick={onToggle} aria-label={task.title}>
        <Tick />
      </button>
      <span className="lab">{task.title}</span>
      {inbox ? <span className="tag inbox">инбокс</span> : goal ? <span className="tag">{goal}</span> : null}
      {overdue ? <span className="due overdue-date">просрочено · {task.dueDate!.slice(5)}</span> : <span className="due" />}
    </div>
  );
}
