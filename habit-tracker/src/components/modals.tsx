"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { useConfirm } from "./confirm";
import { WD_SHORT, todayStr } from "@/lib/date";
import type { GoalType, Schedule, ScheduleType } from "@/lib/types";

export type ModalState =
  | { kind: "create"; goalId?: string | null; date?: string; defaultType?: "task" | "habit" }
  | { kind: "goal" }
  | { kind: "task"; id: string }
  | null;

function Shell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Modals({ modal, onClose }: { modal: ModalState; onClose: () => void }) {
  if (!modal) return null;
  if (modal.kind === "goal") return <GoalModal onClose={onClose} />;
  if (modal.kind === "task") return <TaskDetailModal id={modal.id} onClose={onClose} />;
  return <CreateModal defaultGoal={modal.goalId ?? ""} defaultDate={modal.date} defaultType={modal.defaultType ?? "task"} onClose={onClose} />;
}

function TaskDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { state, updateTask, deleteTask } = useStore();
  const ask = useConfirm();
  const task = state.tasks.find((t) => t.id === id);
  const [title, setTitle] = useState(task?.title ?? "");
  const [desc, setDesc] = useState(task?.description ?? "");
  const [goalId, setGoalId] = useState<string>(task?.goalId ?? "");
  const [due, setDue] = useState(task?.dueDate ?? "");

  if (!task) return null;

  const save = () => {
    updateTask(id, { title: title.trim() || task.title, description: desc, goalId: goalId || null, dueDate: due || null });
    onClose();
  };
  const remove = async () => {
    if (await ask(`Удалить задачу «${task.title}»?`, "Удалить")) {
      deleteTask(id);
      onClose();
    }
  };

  return (
    <Shell title="Задача" onClose={onClose}>
      <div className="row">
        <label>Название</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
      </div>
      <div className="row">
        <label>Описание</label>
        <textarea className="modal-textarea" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Заметки, детали, ссылки…" />
      </div>
      <div className="row">
        <label>Цель</label>
        <select value={goalId} onChange={(e) => setGoalId(e.target.value)}>
          <option value="">— Инбокс (без цели) —</option>
          {state.goals
            .filter((g) => g.status === "active")
            .map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
        </select>
      </div>
      <div className="row">
        <label>Дедлайн</label>
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </div>
      <div className="hint">Создана {task.createdAt.slice(0, 10)}</div>
      <div className="modal-foot" style={{ justifyContent: "space-between" }}>
        <button className="btn ghost" onClick={remove} style={{ color: "var(--down)" }}>
          Удалить
        </button>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn ghost" onClick={onClose}>
            Отмена
          </button>
          <button className="btn primary" onClick={save}>
            Сохранить
          </button>
        </div>
      </div>
    </Shell>
  );
}

/** Единая форма: создать задачу ИЛИ привычку. */
function CreateModal({
  defaultGoal,
  defaultDate,
  defaultType,
  onClose,
}: {
  defaultGoal: string;
  defaultDate?: string;
  defaultType: "task" | "habit";
  onClose: () => void;
}) {
  const { state, addTask, addHabit } = useStore();
  const [type, setType] = useState<"task" | "habit">(defaultType);
  const [title, setTitle] = useState("");
  const [goalId, setGoalId] = useState<string>(defaultGoal);
  const [due, setDue] = useState(defaultDate ?? todayStr());
  const [sched, setSched] = useState<ScheduleType>("daily");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [per, setPer] = useState(3);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);

  const save = () => {
    if (!title.trim()) return;
    if (type === "task") {
      addTask(goalId || null, title.trim(), due || null);
    } else {
      const schedule: Schedule =
        sched === "daily" ? { type: "daily" } : sched === "weekdays" ? { type: "weekdays", days } : { type: "weekly", timesPerWeek: per };
      addHabit(goalId || null, title.trim(), schedule);
    }
    onClose();
  };

  return (
    <Shell title="Создать" onClose={onClose}>
      <div className="row">
        <label>Тип</label>
        <div className="seg">
          <button className={type === "task" ? "on" : ""} onClick={() => setType("task")}>
            Задача
          </button>
          <button className={type === "habit" ? "on" : ""} onClick={() => setType("habit")}>
            ↻ Привычка
          </button>
        </div>
      </div>

      <div className="row">
        <label>{type === "task" ? "Что сделать" : "Название привычки"}</label>
        <input
          ref={ref}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder={type === "task" ? "Например: продлить страховку" : "Например: 20 минут чтения"}
        />
      </div>

      <div className="row">
        <label>Цель</label>
        <select value={goalId} onChange={(e) => setGoalId(e.target.value)}>
          <option value="">— {type === "task" ? "Инбокс (без цели)" : "Без цели"} —</option>
          {state.goals
            .filter((g) => g.status === "active")
            .map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
        </select>
      </div>

      {type === "task" ? (
        <div className="row">
          <label>Дата</label>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
      ) : (
        <>
          <div className="row">
            <label>Расписание</label>
            <div className="seg">
              <button className={sched === "daily" ? "on" : ""} onClick={() => setSched("daily")}>
                Ежедневно
              </button>
              <button className={sched === "weekdays" ? "on" : ""} onClick={() => setSched("weekdays")}>
                По дням
              </button>
              <button className={sched === "weekly" ? "on" : ""} onClick={() => setSched("weekly")}>
                N в неделю
              </button>
            </div>
          </div>
          {sched === "weekdays" && (
            <div className="row">
              <label>Дни недели</label>
              <div className="wd-pick">
                {WD_SHORT.map((w, i) => {
                  const day = i + 1;
                  const on = days.includes(day);
                  return (
                    <button key={day} className={on ? "on" : ""} onClick={() => setDays((s) => (on ? s.filter((x) => x !== day) : [...s, day]))}>
                      {w}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {sched === "weekly" && (
            <div className="row">
              <label>Сколько раз в неделю</label>
              <input type="text" inputMode="numeric" value={String(per)} onChange={(e) => setPer(Math.max(1, Math.min(7, Number(e.target.value) || 1)))} />
            </div>
          )}
        </>
      )}

      <div className="modal-foot">
        <button className="btn ghost" onClick={onClose}>
          Отмена
        </button>
        <button className="btn primary" onClick={save} disabled={!title.trim()}>
          Создать
        </button>
      </div>
    </Shell>
  );
}

function GoalModal({ onClose }: { onClose: () => void }) {
  const { addGoal } = useStore();
  const [name, setName] = useState("");
  const [type, setType] = useState<GoalType>("achievement");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const save = () => {
    if (!name.trim()) return;
    addGoal(name.trim(), type);
    onClose();
  };
  return (
    <Shell title="Новая цель" onClose={onClose}>
      <div className="row">
        <label>Название</label>
        <input ref={ref} type="text" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} placeholder="Например: Английский B2" />
      </div>
      <div className="row">
        <label>Тип цели</label>
        <div className="seg">
          <button className={type === "achievement" ? "on" : ""} onClick={() => setType("achievement")}>
            Достижение
            <small>есть финиш</small>
          </button>
          <button className={type === "maintenance" ? "on" : ""} onClick={() => setType("maintenance")}>
            Поддержание
            <small>удержание режима</small>
          </button>
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn ghost" onClick={onClose}>
          Отмена
        </button>
        <button className="btn primary" onClick={save} disabled={!name.trim()}>
          Создать
        </button>
      </div>
    </Shell>
  );
}
