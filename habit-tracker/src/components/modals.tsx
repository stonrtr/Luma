"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { WD_SHORT, todayStr } from "@/lib/date";
import type { GoalType, Schedule, ScheduleType } from "@/lib/types";

export type ModalState =
  | { kind: "task"; goalId?: string | null; date?: string }
  | { kind: "goal" }
  | { kind: "habit"; goalId: string | null }
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
  if (modal.kind === "task") return <TaskModal defaultGoal={modal.goalId ?? ""} defaultDate={modal.date} onClose={onClose} />;
  if (modal.kind === "goal") return <GoalModal onClose={onClose} />;
  return <HabitModal goalId={modal.goalId} onClose={onClose} />;
}

function TaskModal({ defaultGoal, defaultDate, onClose }: { defaultGoal: string; defaultDate?: string; onClose: () => void }) {
  const { state, addTask } = useStore();
  const [title, setTitle] = useState("");
  const [goalId, setGoalId] = useState<string>(defaultGoal); // "" = инбокс
  const [due, setDue] = useState(defaultDate ?? todayStr());
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);

  const save = () => {
    if (!title.trim()) return;
    addTask(goalId || null, title.trim(), due || null);
    onClose();
  };

  return (
    <Shell title="Быстрая задача" onClose={onClose}>
      <div className="row">
        <label>Что сделать</label>
        <input ref={ref} type="text" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} placeholder="Например: продлить страховку" />
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
        <label>Дата</label>
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        <div className="hint">Пусто у инбокса — задача просто висит в «Сегодня».</div>
      </div>
      <div className="modal-foot">
        <button className="btn ghost" onClick={onClose}>
          Отмена
        </button>
        <button className="btn primary" onClick={save} disabled={!title.trim()}>
          Добавить
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
        <div className="hint">
          {type === "achievement" ? "Прогресс растёт к 100% и цель закрывается." : "Финиша нет — показывается удержание привычек за 30 дней."}
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

function HabitModal({ goalId, onClose }: { goalId: string | null; onClose: () => void }) {
  const { addHabit } = useStore();
  const [name, setName] = useState("");
  const [type, setType] = useState<ScheduleType>("daily");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [per, setPer] = useState(3);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);

  const save = () => {
    if (!name.trim()) return;
    const schedule: Schedule =
      type === "daily" ? { type: "daily" } : type === "weekdays" ? { type: "weekdays", days } : { type: "weekly", timesPerWeek: per };
    addHabit(goalId, name.trim(), schedule);
    onClose();
  };

  return (
    <Shell title="Новая привычка" onClose={onClose}>
      <div className="row">
        <label>Название</label>
        <input ref={ref} type="text" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} placeholder="Например: 20 минут чтения" />
      </div>
      <div className="row">
        <label>Расписание</label>
        <div className="seg">
          <button className={type === "daily" ? "on" : ""} onClick={() => setType("daily")}>
            Ежедневно
          </button>
          <button className={type === "weekdays" ? "on" : ""} onClick={() => setType("weekdays")}>
            По дням
          </button>
          <button className={type === "weekly" ? "on" : ""} onClick={() => setType("weekly")}>
            N в неделю
          </button>
        </div>
      </div>
      {type === "weekdays" && (
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
      {type === "weekly" && (
        <div className="row">
          <label>Сколько раз в неделю</label>
          <input type="text" inputMode="numeric" value={String(per)} onChange={(e) => setPer(Math.max(1, Math.min(7, Number(e.target.value) || 1)))} />
        </div>
      )}
      <div className="modal-foot">
        <button className="btn ghost" onClick={onClose}>
          Отмена
        </button>
        <button className="btn primary" onClick={save} disabled={!name.trim()}>
          Добавить
        </button>
      </div>
    </Shell>
  );
}
