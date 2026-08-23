"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useStore, uid } from "@/lib/store";
import { Task, Priority, Habit, Repeat as RepeatKind, Subtask, CalEvent } from "@/lib/types";
import {
  todayKey, addDays, weekStart, weekDays, fmtHuman, fmtShort, DAY_SHORT,
  monthLabel, fromKey, dayOfWeekMon0, daysBetween, fmtDayMon, toKey,
} from "@/lib/date";
// eslint-disable-next-line
import {
  CheckSmall, Check, FilterLines, Settings2, Plus, ChevronLeft, ChevronRight, ChevronDown,
  Dots, CalendarDay, Clock, Flag, TagIcon, Bolt, Trash, Bell, Repeat, InfoCircle, Flame, ListIcon,
} from "./icons";
import { Modal, Pop, Select, Toggle, Dropdown, MenuItem, DateMenu, PSel } from "./ui";
import { HabitDetailModal, habitStreak, promptHabitValue } from "./Habits";

/* ---------------- shared bits ---------------- */

export function TaskCheck({ task }: { task: Task }) {
  const { toggleTask } = useStore();
  return (
    <button
      className={`task-check${task.completedAt ? " done" : ""}${task.habitId ? " habit" : ""}${
        !task.completedAt && task.priority === "High" ? " p-high"
        : !task.completedAt && task.priority === "Medium" ? " p-medium"
        : !task.completedAt && task.priority === "Low" ? " p-low" : ""}`}
      onClick={(e) => { e.stopPropagation(); toggleTask(task.id); }}
    >
      {task.completedAt && <CheckSmall size={10} />}
    </button>
  );
}

function taskSub(task: Task): React.ReactNode {
  if (!task.date) return null;
  const t = todayKey();
  const overdue = !task.completedAt && task.date < t;
  const time = task.timeStart ? `, ${task.timeStart}${task.timeEnd ? `-${task.timeEnd}` : ""}` : "";
  return <span className={overdue ? "overdue" : undefined}>{fmtHuman(task.date)}{time}</span>;
}

export function TaskRow({ task, onClick, sub }: { task: Task; onClick?: () => void; sub?: React.ReactNode }) {
  const { data, moveTaskBefore } = useStore();
  const t = todayKey();

  let linked: { name: string; color: string } | null = null;
  if (task.goalId) {
    const g = data.goals.find((x) => x.id === task.goalId);
    if (g) {
      const area = data.areas.find((x) => x.id === g.areaId);
      linked = { name: g.name, color: g.color ?? area?.color ?? "#6e6ade" };
    }
  } else if (task.areaId) {
    const a = data.areas.find((x) => x.id === task.areaId);
    if (a) linked = { name: a.name, color: a.color };
  }

  const dl = task.deadline && !task.completedAt ? daysBetween(t, task.deadline) : null;
  const dateSub = sub !== undefined ? sub : taskSub(task);

  return (
    <div
      className="task-row"
      onClick={onClick}
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/task", task.id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const id = e.dataTransfer.getData("text/task");
        if (id && id !== task.id) {
          e.preventDefault();
          e.stopPropagation();
          moveTaskBefore(id, task.id);
        }
      }}
    >
      <TaskCheck task={task} />
      <div className="task-body">
        <div className={`task-title${task.completedAt ? " done" : ""}`}>
          {task.title}
          {task.repeat && <span className="t-repeat"><Repeat size={12} /></span>}
          {task.subtasks && task.subtasks.length > 0 && (
            <span className="head-meta" style={{ marginLeft: 8 }}>
              {task.subtasks.filter((x) => x.done).length}/{task.subtasks.length}
            </span>
          )}
          {dl !== null && (
            <span className={`dl-chip${dl < 0 ? " overdue" : ""}`}>
              <Flag size={11} strokeWidth={2.2} /> {dl === 0 ? "сегодня" : `${dl} дн`}
            </span>
          )}
        </div>
        {(dateSub || linked) && (
          <div className="task-sub">
            {dateSub}
            {linked && (
              <span className="t-link">
                <span className="cbar" style={{ background: linked.color }} />
                {linked.name}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const DURATIONS = [15, 30, 45, 60, 90, 120];
const PRIORITY_RU: Record<string, string> = { High: "Высокий", Medium: "Средний", Low: "Низкий" };

export function AddTask({ defaults, simple }: { defaults?: Partial<Task>; simple?: boolean }) {
  const { data, addTask } = useStore();
  const t = todayKey();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState<string | null>(defaults?.date ?? null);
  const [timeStart, setTimeStart] = useState<string | null>(null);
  const [timeEnd, setTimeEnd] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority | null>(null);
  const [tagId, setTagId] = useState<string | null>(defaults?.tagIds?.[0] ?? null);
  const [link, setLink] = useState(defaults?.goalId ?? (defaults?.areaId ? `a:${defaults.areaId}` : ""));
  const [repeat, setRepeat] = useState<RepeatKind | null>(null);
  const [reminder, setReminder] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  const linked = useMemo(() => {
    if (!link) return null;
    if (link.startsWith("a:")) {
      const a = data.areas.find((x) => x.id === link.slice(2));
      return a ? { name: a.name, color: a.color } : null;
    }
    const g = data.goals.find((x) => x.id === link);
    if (!g) return null;
    const area = data.areas.find((x) => x.id === g.areaId);
    return { name: g.name, color: g.color ?? area?.color ?? "#6e6ade" };
  }, [link, data.areas, data.goals]);

  const submit = () => {
    const v = title.trim();
    if (!v) return;
    addTask({
      title: v,
      notes: notes.trim() || undefined,
      date, timeStart, timeEnd, duration, deadline, priority,
      tagIds: tagId ? [tagId] : [],
      goalId: link && !link.startsWith("a:") ? link : null,
      areaId: link.startsWith("a:") ? link.slice(2) : null,
      repeat,
      reminder,
    });
    setTitle("");
    setNotes("");
  };

  if (simple) {
    return (
      <div className="add-task">
        <span className="task-check" />
        <input
          placeholder="Быстрая идея — Enter, чтобы добавить"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
      </div>
    );
  }

  return (
    <div className={open ? "composer" : undefined} ref={boxRef}>
      <div className={open ? "c-title-row" : "add-task"} onClick={() => !open && setOpen(true)}>
        <span className="task-check" />
        <input
          className={open ? "c-title" : undefined}
          placeholder="Добавить задачу"
          value={title}
          onFocus={() => setOpen(true)}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") setOpen(false);
          }}
        />
      </div>
      {open && (
        <>
          <input
            className="c-notes"
            placeholder="Описание"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <div className="chip-row">
            <Dropdown trigger={
              linked
                ? <span className="chip set"><span className="cbar" style={{ background: linked.color }} />{linked.name}</span>
                : <span className="chip"><Bolt size={15} /> Привязать</span>
            }>
              {(close) => (
                <>
                  {data.goals.filter((g) => !g.parentId).length > 0 && <div className="menu-label">Цели</div>}
                  {data.goals.filter((g) => !g.parentId).map((g) => {
                    const area = data.areas.find((a) => a.id === g.areaId);
                    return (
                      <MenuItem key={g.id} selected={link === g.id} onClick={() => { setLink(g.id); close(); }}>
                        <span className="cbar" style={{ background: g.color ?? area?.color ?? "#6e6ade" }} />{g.name}
                      </MenuItem>
                    );
                  })}
                  <div className="menu-label">Сферы жизни</div>
                  {data.areas.map((a) => (
                    <MenuItem key={a.id} selected={link === `a:${a.id}`} onClick={() => { setLink(`a:${a.id}`); close(); }}>
                      <span className="cbar" style={{ background: a.color }} />{a.name}
                    </MenuItem>
                  ))}
                  <MenuItem selected={!link} onClick={() => { setLink(""); close(); }}>Без привязки</MenuItem>
                </>
              )}
            </Dropdown>

            <Dropdown trigger={
              <span className={`chip${date ? " set" : ""}`}><CalendarDay size={15} /> {date ? fmtHuman(date) : "Дата"}</span>
            }>
              {(close) => <DateMenu value={date} onChange={setDate} close={close} />}
            </Dropdown>

            <Dropdown trigger={
              <span className={`chip${timeStart ? " set" : ""}`}>
                <Clock size={15} /> {timeStart ? `${timeStart}${timeEnd ? `–${timeEnd}` : ""}` : "Время"}
              </span>
            }>
              {(close) => (
                <>
                  <div className="menu-label">Время старта</div>
                  <div className="menu-inp">
                    <input type="time" className="finput" value={timeStart ?? ""}
                      onChange={(e) => setTimeStart(e.target.value || null)} />
                  </div>
                  <div className="menu-label">Время окончания</div>
                  <div className="menu-inp">
                    <input type="time" className="finput" value={timeEnd ?? ""}
                      onChange={(e) => setTimeEnd(e.target.value || null)} />
                  </div>
                  <MenuItem selected={!timeStart && !timeEnd}
                    onClick={() => { setTimeStart(null); setTimeEnd(null); close(); }}>
                    Без времени
                  </MenuItem>
                </>
              )}
            </Dropdown>

            <Dropdown trigger={
              <span className={`chip${duration ? " set" : ""}`}><Clock size={15} /> {duration ? `${duration} мин` : "Длительность"}</span>
            }>
              {(close) => (
                <>
                  {DURATIONS.map((m) => (
                    <MenuItem key={m} selected={duration === m} onClick={() => { setDuration(m); close(); }}>{m} мин</MenuItem>
                  ))}
                  <MenuItem selected={!duration} onClick={() => { setDuration(null); close(); }}>Нет</MenuItem>
                </>
              )}
            </Dropdown>

            <Dropdown trigger={
              <span className={`chip${deadline ? " set" : ""}`}><Flag size={15} /> {deadline ? fmtHuman(deadline) : "Дедлайн"}</span>
            }>
              {(close) => <DateMenu value={deadline} onChange={setDeadline} close={close} noneLabel="Без дедлайна" />}
            </Dropdown>

            <Dropdown trigger={
              <span className={`chip${priority ? " set" : ""}`}><InfoCircle size={15} />{priority ? ` ${PRIORITY_RU[priority]}` : ""}</span>
            }>
              {(close) => (
                <>
                  {(["High", "Medium", "Low"] as Priority[]).map((pr) => (
                    <MenuItem key={pr} selected={priority === pr} onClick={() => { setPriority(pr); close(); }}>{PRIORITY_RU[pr]}</MenuItem>
                  ))}
                  <MenuItem selected={!priority} onClick={() => { setPriority(null); close(); }}>Нет</MenuItem>
                </>
              )}
            </Dropdown>

            <Dropdown trigger={
              <span className={`chip${tagId ? " set" : ""}`}>
                <TagIcon size={15} />{tagId ? ` ${data.tags.find((x) => x.id === tagId)?.name ?? ""}` : ""}
              </span>
            }>
              {(close) => (
                <>
                  {data.tags.length === 0 && <div className="menu-label">Пока нет тегов</div>}
                  {data.tags.map((tg) => (
                    <MenuItem key={tg.id} selected={tagId === tg.id} onClick={() => { setTagId(tg.id); close(); }}>{tg.name}</MenuItem>
                  ))}
                  {data.tags.length > 0 && (
                    <MenuItem selected={!tagId} onClick={() => { setTagId(null); close(); }}>Без тега</MenuItem>
                  )}
                </>
              )}
            </Dropdown>

            <button type="button" className={`chip${reminder ? " set" : ""}`} title="Напоминание в момент начала"
              onClick={() => {
                if (!reminder && typeof Notification !== "undefined" && Notification.permission === "default") {
                  Notification.requestPermission();
                }
                setReminder(!reminder);
              }}>
              <Bell size={15} />{reminder ? " вкл" : ""}
            </button>
            <Dropdown trigger={
              <span className={`chip${repeat ? " set" : ""}`}>
                <Repeat size={15} />{repeat === "daily" ? " каждый день" : repeat === "weekly" ? " каждую неделю" : repeat === "monthly" ? " каждый месяц" : ""}
              </span>
            }>
              {(close) => (
                <>
                  <MenuItem selected={repeat === "daily"} onClick={() => { setRepeat("daily"); close(); }}>Каждый день</MenuItem>
                  <MenuItem selected={repeat === "weekly"} onClick={() => { setRepeat("weekly"); close(); }}>Каждую неделю</MenuItem>
                  <MenuItem selected={repeat === "monthly"} onClick={() => { setRepeat("monthly"); close(); }}>Каждый месяц</MenuItem>
                  <MenuItem selected={!repeat} onClick={() => { setRepeat(null); close(); }}>Без повтора</MenuItem>
                </>
              )}
            </Dropdown>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- Task modal ---------------- */

export function TaskModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const { data, updateTask, set } = useStore();
  const [f, setF] = useState<Task>({ ...task });
  const goals = data.goals.filter((g) => !g.parentId);

  const save = () => {
    updateTask(task.id, f);
    onClose();
  };
  const remove = () => {
    set((d) => ({
      ...d,
      tasks: d.tasks.map((t) => (t.id === task.id ? { ...t, deletedAt: new Date().toISOString() } : t)),
    }));
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <div className="modal-scroll">
        <div className="modal-head">
          <div className="m-icon"><Check size={22} /></div>
          <div className="m-titles">
            <input className="m-name" value={f.title} placeholder="Название задачи"
              onChange={(e) => setF({ ...f, title: e.target.value })} />
            <input className="m-desc" value={f.notes ?? ""} placeholder="Описание"
              onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </div>
        </div>

        <div className="frow">
          <div className="flabel"><span className="fic"><CalendarDay size={17} /></span>Дата</div>
          <div className="fctrl">
            <input type="date" className="finput" value={f.date ?? ""}
              onChange={(e) => setF({ ...f, date: e.target.value || null })} />
          </div>
        </div>
        <div className="frow">
          <div className="flabel"><span className="fic"><Clock size={17} /></span>Время</div>
          <div className="fctrl">
            <input type="time" className="finput" value={f.timeStart ?? ""}
              onChange={(e) => setF({ ...f, timeStart: e.target.value || null })} />
            <input type="time" className="finput" value={f.timeEnd ?? ""}
              onChange={(e) => setF({ ...f, timeEnd: e.target.value || null })} />
          </div>
        </div>
        <div className="frow">
          <div className="flabel"><span className="fic"><Clock size={17} /></span>Длительность</div>
          <div className="fctrl">
            <Select value={f.duration ? String(f.duration) : ""} placeholder="Выбрать"
              onChange={(v) => setF({ ...f, duration: v ? Number(v) : null })}>
              {[15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} мин</option>)}
            </Select>
          </div>
        </div>
        <div className="frow">
          <div className="flabel"><span className="fic"><Flag size={17} /></span>Дедлайн</div>
          <div className="fctrl">
            <input type="date" className="finput" value={f.deadline ?? ""}
              onChange={(e) => setF({ ...f, deadline: e.target.value || null })} />
          </div>
        </div>
        <div className="fsep" />
        <div className="frow">
          <div className="flabel"><span className="fic"><Bolt size={17} /></span>Привязать к</div>
          <div className="fctrl">
            <Select value={f.goalId ?? (f.areaId ? `a:${f.areaId}` : "")} placeholder="Выбрать"
              onChange={(v) => {
                if (v.startsWith("a:")) setF({ ...f, areaId: v.slice(2), goalId: null });
                else setF({ ...f, goalId: v || null, areaId: null });
              }}>
              <optgroup label="Цели">
                {goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </optgroup>
              <optgroup label="Сферы жизни">
                {data.areas.map((a) => <option key={a.id} value={`a:${a.id}`}>{a.name}</option>)}
              </optgroup>
            </Select>
          </div>
        </div>
        <div className="frow">
          <div className="flabel"><span className="fic"><Flag size={17} /></span>Приоритет</div>
          <div className="fctrl">
            <Select value={f.priority ?? ""} placeholder="Выбрать"
              onChange={(v) => setF({ ...f, priority: (v || null) as Priority | null })}>
              <option value="High">Высокий</option>
              <option value="Medium">Средний</option>
              <option value="Low">Низкий</option>
            </Select>
          </div>
        </div>
        <div className="frow">
          <div className="flabel"><span className="fic"><TagIcon size={17} /></span>Теги</div>
          <div className="fctrl">
            <Select value={f.tagIds[0] ?? ""} placeholder="Выбрать"
              onChange={(v) => setF({ ...f, tagIds: v ? [v] : [] })}>
              {data.tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </div>
        </div>
        <div className="frow">
          <div className="flabel"><span className="fic"><Repeat size={17} /></span>Повтор</div>
          <div className="fctrl">
            <Select value={f.repeat ?? ""} placeholder="Нет"
              onChange={(v) => setF({ ...f, repeat: (v || null) as RepeatKind | null })}>
              <option value="daily">Каждый день</option>
              <option value="weekly">Каждую неделю</option>
              <option value="monthly">Каждый месяц</option>
            </Select>
          </div>
        </div>
        <div className="frow">
          <div className="flabel"><span className="fic"><Bell size={17} /></span>Напоминание</div>
          <div className="fctrl">
            <Toggle on={!!f.reminder} onChange={(v) => {
              if (v && typeof Notification !== "undefined" && Notification.permission === "default") {
                Notification.requestPermission();
              }
              setF({ ...f, reminder: v });
            }} />
            <span className="muted" style={{ fontSize: 13 }}>в момент начала (нужны время и дата)</span>
          </div>
        </div>

        <div className="fsep" />
        <SubtaskEditor
          subtasks={f.subtasks ?? []}
          onChange={(subtasks) => setF({ ...f, subtasks })}
        />
      </div>
      <div className="modal-foot">
        <button className="btn-ghost" style={{ marginRight: "auto", color: "#e5484d" }} onClick={remove}>
          <Trash size={15} />
        </button>
        <button className="btn-ghost" onClick={onClose}>Отмена</button>
        <button className="btn-primary" onClick={save}>Сохранить</button>
      </div>
    </Modal>
  );
}

/* ---------------- Импорт календаря (.ics) ---------------- */

function parseIcs(text: string): CalEvent[] {
  // разворачиваем перенесённые строки (RFC 5545 folding)
  const lines = text.replace(/\r/g, "").split("\n").reduce<string[]>((acc, ln) => {
    if ((ln.startsWith(" ") || ln.startsWith("\t")) && acc.length) acc[acc.length - 1] += ln.slice(1);
    else acc.push(ln);
    return acc;
  }, []);
  const events: CalEvent[] = [];
  let cur: Record<string, string> | null = null;
  for (const ln of lines) {
    if (ln === "BEGIN:VEVENT") cur = {};
    else if (ln === "END:VEVENT") {
      if (cur && cur.DTSTART && cur.SUMMARY) {
        const parse = (v: string) => {
          const m = v.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})\d{2}(Z?))?/);
          if (!m) return null;
          if (m[6] === "Z") {
            const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0)));
            const pad = (n: number) => String(n).padStart(2, "0");
            return {
              date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
              time: m[4] ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : null,
            };
          }
          return {
            date: `${m[1]}-${m[2]}-${m[3]}`,
            time: m[4] ? `${m[4]}:${m[5]}` : null,
          };
        };
        const st = parse(cur.DTSTART);
        const en = cur.DTEND ? parse(cur.DTEND) : null;
        if (st) {
          events.push({
            id: uid(),
            title: cur.SUMMARY,
            date: st.date,
            timeStart: st.time,
            timeEnd: en && en.date === st.date ? en.time : null,
          });
        }
      }
      cur = null;
    } else if (cur) {
      const i = ln.indexOf(":");
      if (i > 0) {
        const key = ln.slice(0, i).split(";")[0];
        cur[key] = ln.slice(i + 1);
      }
    }
  }
  return events;
}

export function CalendarConnectModal({ onClose }: { onClose: () => void }) {
  const { data, set } = useStore();
  const [imported, setImported] = useState<number | null>(null);
  const count = data.calendarEvents?.length ?? 0;

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const events = parseIcs(String(reader.result));
      set((d) => ({ ...d, calendarEvents: [...(d.calendarEvents ?? []), ...events] }));
      setImported(events.length);
    };
    reader.readAsText(file);
  };

  return (
    <Modal onClose={onClose} width={520}>
      <div className="modal-scroll" style={{ paddingBottom: 10 }}>
        <div className="modal-head" style={{ marginBottom: 10 }}>
          <div className="m-icon"><CalendarDay size={22} /></div>
          <div className="m-titles">
            <div style={{ fontSize: 19, fontWeight: 700 }}>Подключить календарь</div>
            <div style={{ fontSize: 13.5, color: "#6f6f6f" }}>Импорт событий из файла .ics</div>
          </div>
        </div>
        <p style={{ fontSize: 14, color: "#6f6f6f", lineHeight: 1.5, marginBottom: 12 }}>
          Экспортируйте календарь из Google Calendar (Настройки → Импорт и экспорт → Экспорт)
          или Apple Calendar и выберите файл — события появятся в «Сегодня» и «Предстоящих».
        </p>
        <label className="btn-primary" style={{ cursor: "pointer" }}>
          Выбрать файл .ics
          <input type="file" accept=".ics,text/calendar" style={{ display: "none" }}
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
        {imported !== null && (
          <div style={{ marginTop: 10, fontSize: 14, color: "var(--green)" }}>
            Импортировано событий: {imported}
          </div>
        )}
        {count > 0 && (
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 14, color: "#6f6f6f" }}>Всего в приложении: {count}</span>
            <button className="btn-ghost" style={{ color: "var(--red)", fontSize: 13.5 }}
              onClick={() => set((d) => ({ ...d, calendarEvents: [] }))}>
              Удалить все события
            </button>
          </div>
        )}
      </div>
      <div className="modal-foot">
        <button className="btn-ghost" onClick={onClose}>Закрыть</button>
      </div>
    </Modal>
  );
}

/* ---------------- Subtasks ---------------- */

export function SubtaskEditor({ subtasks, onChange }: {
  subtasks: Subtask[];
  onChange: (s: Subtask[]) => void;
}) {
  const [text, setText] = useState("");
  const add = () => {
    const v = text.trim();
    if (!v) return;
    onChange([...subtasks, { id: uid(), title: v, done: false }]);
    setText("");
  };
  return (
    <div style={{ paddingBottom: 6 }}>
      {subtasks.map((st) => (
        <div key={st.id} className="task-row" style={{ padding: "5px 0" }}>
          <button
            className={`task-check${st.done ? " done" : ""}`}
            style={{ width: 16, height: 16 }}
            onClick={() => onChange(subtasks.map((x) => (x.id === st.id ? { ...x, done: !x.done } : x)))}
          >
            {st.done && <CheckSmall size={9} />}
          </button>
          <div className="task-body">
            <div className={`task-title${st.done ? " done" : ""}`} style={{ fontSize: 14 }}>{st.title}</div>
          </div>
          <button className="icon-btn" style={{ width: 24, height: 24 }}
            onClick={() => onChange(subtasks.filter((x) => x.id !== st.id))}>
            <Trash size={13} />
          </button>
        </div>
      ))}
      <div className="add-task" style={{ padding: "5px 0" }}>
        <span className="task-check" style={{ width: 16, height: 16 }} />
        <input placeholder="Подзадача" value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          onBlur={add} />
      </div>
    </div>
  );
}

/* ---------------- Filter popover ---------------- */

export interface TaskFilters {
  sort: string;
  group: string;
  tagId: string;
  duration: string;
  priority: string;
}
export const EMPTY_FILTERS: TaskFilters = { sort: "", group: "", tagId: "", duration: "", priority: "" };
export function hasActiveFilters(f: TaskFilters): boolean {
  return !!(f.sort || f.group || f.tagId || f.duration || f.priority);
}

/** Группировка задач: [заголовок, задачи][] */
export function groupTasks(
  tasks: Task[],
  group: string,
  data: { areas: { id: string; name: string }[]; goals: { id: string; areaId?: string | null }[] }
): [string, Task[]][] {
  if (!group) return [["", tasks]];
  const buckets = new Map<string, Task[]>();
  const push = (key: string, t: Task) => {
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(t);
  };
  const t0 = todayKey();
  for (const t of tasks) {
    if (group === "date") {
      if (!t.date) push("Без даты", t);
      else if (t.date < t0) push("Просрочено", t);
      else push(fmtHuman(t.date), t);
    } else if (group === "priority") {
      push(t.priority === "High" ? "Высокий" : t.priority === "Medium" ? "Средний" : t.priority === "Low" ? "Низкий" : "Без приоритета", t);
    } else if (group === "area") {
      const areaId = t.areaId ?? data.goals.find((g) => g.id === t.goalId)?.areaId;
      push(data.areas.find((a) => a.id === areaId)?.name ?? "Без сферы", t);
    }
  }
  return [...buckets.entries()];
}
export function applyTaskFilters(tasks: Task[], f: TaskFilters): Task[] {
  let list = tasks;
  if (f.tagId) list = list.filter((t) => t.tagIds.includes(f.tagId));
  if (f.priority) list = list.filter((t) => t.priority === f.priority);
  if (f.duration) list = list.filter((t) => String(t.duration ?? "") === f.duration);
  if (f.sort === "date") list = [...list].sort((a, b) => ((a.date ?? "9999") < (b.date ?? "9999") ? -1 : 1));
  if (f.sort === "name") list = [...list].sort((a, b) => a.title.localeCompare(b.title, "ru"));
  if (f.sort === "priority") {
    const rank: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
    list = [...list].sort((a, b) => (rank[a.priority ?? ""] ?? 3) - (rank[b.priority ?? ""] ?? 3));
  }
  return list;
}

function FilterPopover({ onClose, filters, setFilters }: {
  onClose: () => void;
  filters: TaskFilters;
  setFilters: (f: TaskFilters) => void;
}) {
  const { data } = useStore();
  const set = (patch: Partial<TaskFilters>) => setFilters({ ...filters, ...patch });
  return (
    <Pop onClose={onClose} className="filter-pop" style={{ top: 52, right: 16 }}>
      <div className="pop-head">Фильтр задач</div>
      <div className="pop-body">
        <div className="pop-sub">Сортировка и группировка</div>
        <div className="pop-row">
          <div className="flabel"><span className="fic"><Settings2 size={16} /></span>Сортировка</div>
          <PSel value={filters.sort} placeholder="Вручную" onChange={(v) => set({ sort: v })}
            options={[
              { v: "date", l: "По дате" },
              { v: "priority", l: "По приоритету" },
              { v: "name", l: "По названию" },
            ]} />
        </div>
        <div className="pop-row">
          <div className="flabel"><span className="fic"><FilterLines size={16} /></span>Группировка</div>
          <PSel value={filters.group} placeholder="Нет" onChange={(v) => set({ group: v })}
            options={[
              { v: "date", l: "По дате" },
              { v: "priority", l: "По приоритету" },
              { v: "area", l: "По сфере жизни" },
            ]} />
        </div>
        <div className="pop-sep" />
        <div className="pop-sub">Фильтры</div>
        <div className="pop-row">
          <div className="flabel"><span className="fic"><TagIcon size={16} /></span>Теги</div>
          <PSel value={filters.tagId} placeholder="Выбрать" onChange={(v) => set({ tagId: v })}
            options={data.tags.map((t) => ({ v: t.id, l: t.name }))} />
        </div>
        <div className="pop-row">
          <div className="flabel"><span className="fic"><Clock size={16} /></span>Длительность</div>
          <PSel value={filters.duration} placeholder="Выбрать" onChange={(v) => set({ duration: v })}
            options={[
              { v: "15", l: "15 мин" }, { v: "30", l: "30 мин" }, { v: "45", l: "45 мин" },
              { v: "60", l: "1 ч" }, { v: "90", l: "1,5 ч" }, { v: "120", l: "2 ч" },
            ]} />
        </div>
        <div className="pop-row">
          <div className="flabel"><span className="fic"><InfoCircle size={16} /></span>Приоритет</div>
          <PSel value={filters.priority} placeholder="Выбрать" onChange={(v) => set({ priority: v })}
            options={[
              { v: "High", l: "Высокий" }, { v: "Medium", l: "Средний" }, { v: "Low", l: "Низкий" },
            ]} />
        </div>
      </div>
      {hasActiveFilters(filters) && (
        <button className="pop-reset" onClick={() => setFilters(EMPTY_FILTERS)}>Сбросить фильтры</button>
      )}
    </Pop>
  );
}

/* ---------------- list page scaffold ---------------- */

function ListPage({
  title, tasks, completedTasks, showAdd, simpleAdd, addDefaults, emptyText, headExtra,
}: {
  title: string;
  tasks: Task[];
  completedTasks?: Task[];
  showAdd?: boolean;
  simpleAdd?: boolean;
  addDefaults?: Partial<Task>;
  emptyText?: React.ReactNode;
  headExtra?: React.ReactNode;
}) {
  const { data } = useStore();
  const [filterOpen, setFilterOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS);
  const [editing, setEditing] = useState<Task | null>(null);
  const base = showCompleted && completedTasks ? [...tasks, ...completedTasks] : tasks;
  const shown = applyTaskFilters(base, filters);
  const filteredOut = shown.length === 0 && base.length > 0 && hasActiveFilters(filters);
  return (
    <>
      <div className="page-head">
        <div className="page-title">{title}</div>
        <div className="spacer" />
        {headExtra}
        <button className="icon-btn" onClick={() => setFilterOpen(true)}><FilterLines size={18} /></button>
        {completedTasks !== undefined && (
          <button className="icon-btn" onClick={() => setSettingsOpen(true)}><Settings2 size={18} /></button>
        )}
      </div>
      {filterOpen && <FilterPopover onClose={() => setFilterOpen(false)} filters={filters} setFilters={setFilters} />}
      {settingsOpen && (
        <Pop onClose={() => setSettingsOpen(false)} style={{ top: 58, right: 16, width: 340 }}>
          <div className="pop-row" style={{ padding: "2px 0" }}>
            <div className="flabel" style={{ fontSize: 15 }}>Показывать выполненные</div>
            <Toggle on={showCompleted} onChange={setShowCompleted} />
          </div>
        </Pop>
      )}
      <div className="main-scroll">
        {filteredOut ? (
          <div className="empty-filtered">
            <div className="ef-icon"><FilterLines size={44} strokeWidth={1.1} /></div>
            <p>Ни одна задача не подходит под выбранные фильтры.</p>
            <button onClick={() => setFilters(EMPTY_FILTERS)}>Сбросить фильтры</button>
          </div>
        ) : (
          <div className="task-list">
            {groupTasks(shown, filters.group, data).map(([label, groupItems]) => (
              <React.Fragment key={label || "all"}>
                {label && (
                  <div className="group-head">
                    <span className="group-title">{label}</span>
                    <span className="group-date">{groupItems.length}</span>
                    <span className="spacer" />
                  </div>
                )}
                {groupItems.map((t) => (
                  <TaskRow key={t.id} task={t} onClick={() => setEditing(t)} />
                ))}
              </React.Fragment>
            ))}
            {showAdd && <AddTask defaults={addDefaults} simple={simpleAdd} />}
            {shown.length === 0 && !showAdd && emptyText}
          </div>
        )}
      </div>
      {editing && <TaskModal task={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function useVisibleTasks() {
  const { data } = useStore();
  return data.tasks.filter((t) => !t.deletedAt);
}

export function TagView({ id }: { id: string }) {
  const { data } = useStore();
  const tag = data.tags.find((t) => t.id === id);
  const all = useVisibleTasks();
  if (!tag) return <div className="empty-state" style={{ paddingTop: 120 }}><p>Тег не найден</p></div>;
  const tasks = all.filter((t) => t.tagIds.includes(id) && !t.completedAt);
  const completed = all.filter((t) => t.tagIds.includes(id) && !!t.completedAt);
  return (
    <ListPage
      title={tag.name}
      tasks={tasks}
      completedTasks={completed}
      showAdd
      addDefaults={{ tagIds: [id] }}
      headExtra={<span className="cbar" style={{ background: tag.color, height: 16, marginRight: "auto" }} />}
    />
  );
}

/* ---------------- Views ---------------- */

export function InboxView() {
  const all = useVisibleTasks();
  const tasks = all.filter((t) => !t.date && !t.completedAt && !t.goalId && !t.areaId);
  const completed = all.filter((t) => !t.date && !!t.completedAt && !t.goalId && !t.areaId);
  return <ListPage title="Идеи" tasks={tasks} completedTasks={completed} showAdd simpleAdd addDefaults={{}} />;
}

export function AllTasksView() {
  const all = useVisibleTasks();
  // идеи (без даты и привязок) живут только в «Идеях»
  const isIdea = (t: Task) => !t.date && !t.goalId && !t.areaId;
  const tasks = all.filter((t) => !t.completedAt && !isIdea(t))
    .sort((a, b) => (a.date ?? "9999") < (b.date ?? "9999") ? -1 : 1);
  const completed = all.filter((t) => !!t.completedAt && !isIdea(t));
  return <ListPage title="Все задачи" tasks={tasks} completedTasks={completed} showAdd addDefaults={{ date: todayKey() }} />;
}

export function CompletedView() {
  const tasks = useVisibleTasks().filter((t) => !!t.completedAt);
  return (
    <ListPage
      title="Выполненные"
      tasks={tasks}
      emptyText={
        <div className="empty-state" style={{ paddingTop: 160 }}>
          <div className="es-icon"><Check size={40} strokeWidth={1.2} /></div>
          <p style={{ fontSize: 15, color: "#6f6f6f" }}>За последние 14 дней нет выполненных задач.</p>
        </div>
      }
    />
  );
}

export function TrashView() {
  const { data, set } = useStore();
  const tasks = data.tasks.filter((t) => !!t.deletedAt);
  return (
    <>
      <div className="page-head">
        <div className="page-title">Архив</div>
        <div className="spacer" />
        {tasks.length > 0 && (
          <button className="btn-secondary" onClick={() => set((d) => ({ ...d, tasks: d.tasks.filter((t) => !t.deletedAt) }))}>
            Очистить архив
          </button>
        )}
      </div>
      <div className="main-scroll">
        <div className="task-list">
          {tasks.map((t) => (
            <div key={t.id} className="task-row">
              <span className="task-check" />
              <div className="task-body">
                <div className="task-title" style={{ color: "#a8a8a8" }}>{t.title}</div>
              </div>
              <button className="btn-ghost" style={{ fontSize: 13 }}
                onClick={() => set((d) => ({ ...d, tasks: d.tasks.map((x) => x.id === t.id ? { ...x, deletedAt: null } : x) }))}>
                Восстановить
              </button>
            </div>
          ))}
          {tasks.length === 0 && (
            <div className="empty-state" style={{ paddingTop: 160 }}>
              <div className="es-icon"><Trash size={40} strokeWidth={1.2} /></div>
              <p style={{ fontSize: 15, color: "#6f6f6f" }}>Архив пуст.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ---------------- Today (list + day calendar) ---------------- */

function fmtAgo(days: number): string {
  if (days === 1) return "вчера";
  return `${days} дн назад`;
}

function fmtMinutes(total: number): string {
  const h = Math.floor(total / 60), m = total % 60;
  if (h && m) return `${h} ч ${m} м`;
  if (h) return `${h} ч`;
  return `${m} мин`;
}

function habitActiveToday(h: Habit, date: string): boolean {
  if (date < h.startDate) return false;
  if (h.endDate && date > h.endDate) return false;
  if (h.schedule === "custom") return h.daysOfWeek.includes(dayOfWeekMon0(date));
  return true;
}

function HabitTaskRow({ habit }: { habit: Habit }) {
  const { data, logHabit } = useStore();
  const t = todayKey();
  const [detail, setDetail] = useState(false);
  const log = data.habitLogs.find((l) => l.habitId === habit.id && l.date === t);
  const count = log?.count ?? 0;
  const status = log?.status;
  const full = count >= habit.timesPerDay;
  return (
    <>
      <div className="task-row" onClick={() => setDetail(true)}>
        {status ? (
          <button
            className={`st-ico ${status}`}
            title="Нажмите, чтобы вернуть"
            onClick={(e) => { e.stopPropagation(); logHabit(habit.id, t, 0); }}
          >
            {status === "moved" ? "»" : status === "skipped" ? "→" : "✕"}
          </button>
        ) : (
          <button
            className={`task-check habit${full ? " done" : ""}`}
            style={!full && count > 0 ? {
              background: `conic-gradient(var(--accent) ${(count / habit.timesPerDay) * 360}deg, #fff 0)`,
              borderColor: "var(--accent)",
            } : undefined}
            onClick={(e) => {
              e.stopPropagation();
              if (habit.enterValue) {
                const v = promptHabitValue(habit, count);
                if (v !== null) logHabit(habit.id, t, v);
              } else {
                logHabit(habit.id, t, full ? 0 : count + 1);
              }
            }}
          >
            {full && <CheckSmall size={10} />}
          </button>
        )}
        <div className="task-body">
          <div className={`task-title${full ? " done" : ""}`}>
            {habit.name}
            {!status && habit.timesPerDay > 1 && (
              <span className="head-meta" style={{ marginLeft: 8 }}>{Math.min(count, habit.timesPerDay)}/{habit.timesPerDay}</span>
            )}
            <span className="t-repeat"><Repeat size={13} /></span>
          </div>
          {status && (
            <div className="task-sub">
              {status === "moved" && (log?.movedTo ? fmtHuman(log.movedTo) : "Перенесено")}
              {status === "skipped" && "Пропущено"}
              {status === "failed" && <span className="overdue">Провалено</span>}
            </div>
          )}
        </div>
        {habitStreak(habit, data.habitLogs) > 0 && (
          <span className="streak" style={{ marginLeft: "auto", marginRight: 6, alignSelf: "center" }}>
            <Flame size={13} /> {habitStreak(habit, data.habitLogs)}
          </span>
        )}
      </div>
      {detail && <HabitDetailModal habitId={habit.id} onClose={() => setDetail(false)} />}
    </>
  );
}

export function TodayView() {
  const { data, updateTask } = useStore();
  const t = todayKey();
  const all = useVisibleTasks();
  const [editing, setEditing] = useState<Task | null>(null);
  const [banner, setBanner] = useState(true);
  const [overdueOpen, setOverdueOpen] = useState(true);
  const [todayOpen, setTodayOpen] = useState(true);
  const [habitsOpen, setHabitsOpen] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showHabits, setShowHabits] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS);
  const [calModal, setCalModal] = useState(false);
  const tasks = applyTaskFilters(all.filter((x) => !x.completedAt && x.date && x.date <= t), filters);
  const timed = tasks.filter((x) => x.timeStart);
  const allday = tasks.filter((x) => !x.timeStart);

  const overdue = tasks.filter((x) => x.date! < t);
  const todays = tasks.filter((x) => x.date === t);
  const habitsToday = data.habits.filter((h) => h.showInTasks && habitActiveToday(h, t));
  const totalMin = tasks.reduce((sum, x) => sum + (x.duration ?? 0), 0);

  const reschedule = (date: string) => {
    for (const x of overdue) updateTask(x.id, { date });
  };

  const overdueSub = (x: Task) => (
    <span className="overdue">
      {fmtAgo(daysBetween(x.date!, t))}
      {x.timeStart ? `, ${x.timeStart}${x.timeEnd ? `-${x.timeEnd}` : ""}` : ""}
    </span>
  );

  return (
    <div className="today-split">
      <div className="today-left">
        <div className="page-head">
          <div className="page-title">Сегодня</div>
          {totalMin > 0 && <span className="head-meta">{fmtMinutes(totalMin)}</span>}
          <div className="spacer" />
          <button className="icon-btn" onClick={() => {
            const inp = document.querySelector<HTMLInputElement>(".today-left .add-task input, .today-left .composer input.c-title");
            inp?.focus();
          }}><Plus size={18} /></button>
          <button className="icon-btn" onClick={() => setFilterOpen(true)}><FilterLines size={18} /></button>
          <button className="icon-btn" onClick={() => setSettingsOpen(true)}><Settings2 size={18} /></button>
          <span style={{ width: 1, height: 20, background: "#e6e6e6" }} />
          <button className="icon-btn" style={panelOpen ? { background: "#ececec", color: "var(--text)" } : undefined}
            onClick={() => setPanelOpen(!panelOpen)}><CalendarDay size={18} /></button>
        </div>

        {filterOpen && <FilterPopover onClose={() => setFilterOpen(false)} filters={filters} setFilters={setFilters} />}
        {settingsOpen && (
          <Pop onClose={() => setSettingsOpen(false)} style={{ top: 58, right: 16, width: 320 }}>
            <div className="pop-row" style={{ padding: "2px 0" }}>
              <div className="flabel" style={{ fontSize: 15 }}>Показывать привычки</div>
              <Toggle on={showHabits} onChange={setShowHabits} />
            </div>
          </Pop>
        )}
        <div className="task-list">
          {overdue.length > 0 && (
            <>
              <div className="group-head">
                <span className="group-title">Просрочено</span>
                <span className="spacer" />
                <Dropdown align="right" trigger={
                  <span className="group-action">Перенести <ChevronDownSmall /></span>
                }>
                  {(close) => (
                    <>
                      <MenuItem onClick={() => { reschedule(t); close(); }}>На сегодня</MenuItem>
                      <MenuItem onClick={() => { reschedule(addDays(t, 1)); close(); }}>На завтра</MenuItem>
                      <MenuItem onClick={() => { reschedule(addDays(t, 7)); close(); }}>Через неделю</MenuItem>
                    </>
                  )}
                </Dropdown>
                <button className="group-chev" onClick={() => setOverdueOpen(!overdueOpen)}>
                  {overdueOpen ? <ChevronUpSmall /> : <ChevronDownSmall />}
                </button>
              </div>
              {overdueOpen && overdue.map((x) => (
                <TaskRow key={x.id} task={x} onClick={() => setEditing(x)} sub={overdueSub(x)} />
              ))}
            </>
          )}

          <div className="group-head">
            <span className="group-title">Сегодня</span>
            <span className="group-date">{fmtDayMon(t)}</span>
            <span className="spacer" />
            <button className="group-chev" onClick={() => setTodayOpen(!todayOpen)}>
              {todayOpen ? <ChevronUpSmall /> : <ChevronDownSmall />}
            </button>
          </div>
          {todayOpen && (
            <>
              {todays.map((x) => <TaskRow key={x.id} task={x} onClick={() => setEditing(x)} />)}
              <AddTask defaults={{ date: t }} />
            </>
          )}

          {showHabits && habitsToday.length > 0 && (
            <>
              <div className="group-head">
                <span className="group-title">Привычки</span>
                <span className="spacer" />
                <button className="group-chev" onClick={() => setHabitsOpen(!habitsOpen)}>
                  {habitsOpen ? <ChevronUpSmall /> : <ChevronDownSmall />}
                </button>
              </div>
              {habitsOpen && habitsToday.map((h) => <HabitTaskRow key={h.id} habit={h} />)}
            </>
          )}
        </div>
      </div>

      {panelOpen && <div className="today-right">
        <div className="tr-head">
          <div className="tr-title">Сегодня</div>
          <Dropdown align="right" trigger={<span className="icon-btn"><Settings2 size={17} /></span>}>
            {(close) => (
              <MenuItem onClick={() => { setBanner(true); close(); }}>Показать баннер календаря</MenuItem>
            )}
          </Dropdown>
        </div>
        {banner && (
          <div className="connect-banner">
            <div className="cb-text">
              <div className="cb-title">Подключите календарь</div>
              <div className="cb-sub">Синхронизация в обе стороны</div>
            </div>
            <button className="btn-primary" onClick={() => setCalModal(true)}>Подключить</button>
            <button className="icon-btn" onClick={() => setBanner(false)}>✕</button>
          </div>
        )}
        <DayTimeline allday={allday} timed={timed} onOpen={setEditing} />
      </div>}
      {calModal && <CalendarConnectModal onClose={() => setCalModal(false)} />}
      {editing && <TaskModal task={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function timeFromDropY(e: React.MouseEvent | React.DragEvent, el: HTMLElement): [string, number] {
  const rect = el.getBoundingClientRect();
  const y = e.clientY - rect.top + el.scrollTop;
  const totalMin = Math.max(0, Math.min(23.5 * 60, Math.round(y)));
  const snapped = Math.round(totalMin / 30) * 30;
  const h = Math.floor(snapped / 60), m = snapped % 60;
  return [`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, snapped];
}

/** Растягивание события за нижний край: коммит на mouseup, шаг 30 мин */
function startEventResize(
  e: React.MouseEvent,
  task: Task,
  updateTask: (id: string, patch: Partial<Task>) => void
) {
  e.stopPropagation();
  e.preventDefault();
  const startClientY = e.clientY;
  const startMin = hourToY(task.timeStart!);
  const origEnd = task.timeEnd ? hourToY(task.timeEnd) : startMin + 60;
  const up = (ev: MouseEvent) => {
    const delta = ev.clientY - startClientY;
    let end = Math.round((origEnd + delta) / 30) * 30;
    end = Math.max(startMin + 30, Math.min(24 * 60, end));
    updateTask(task.id, {
      timeEnd: `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`,
    });
    document.removeEventListener("mouseup", up);
  };
  document.addEventListener("mouseup", up);
}

function shiftEnd(start: string, task: Task): string {
  const dur = task.timeStart && task.timeEnd
    ? Math.max(30, hourToY(task.timeEnd) - hourToY(task.timeStart))
    : 60;
  const total = Math.min(24 * 60, hourToY(start) + dur);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function hourToY(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h + m / 60) * 60;
}

function DayTimeline({ allday, timed, onOpen }: { allday: Task[]; timed: Task[]; onOpen: (t: Task) => void }) {
  const { data, updateTask, addTask } = useStore();
  const t = todayKey();
  const events = (data.calendarEvents ?? []).filter((e) => e.date === t);
  const now = new Date();
  const nowY = (now.getHours() + now.getMinutes() / 60) * 60;
  return (
    <div style={{ flex: 1, overflowY: "auto", position: "relative" }}
      ref={(el) => { if (el && !el.dataset.scrolled) { el.dataset.scrolled = "1"; el.scrollTop = Math.max(0, nowY - 220); } }}>
      <div className="cal-allday" style={{ borderTop: "1px solid var(--border-soft)" }}>
        <div className="cal-allday-label">весь день</div>
        <div className="cal-allday-col">
          {events.filter((e) => !e.timeStart).map((e) => (
            <div key={e.id} className="cal-event ghost" style={{ position: "static", marginBottom: 3 }}>{e.title}</div>
          ))}
          {allday.map((t) => (
            <div key={t.id} className="cal-event" style={{ position: "static", marginBottom: 3 }} onClick={() => onOpen(t)}>
              <TaskCheck task={t} />{t.title}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "58px 1fr", position: "relative" }}>
        <div className="cal-hours">
          {Array.from({ length: 24 }, (_, h) => (h === 0 ? null : (
            <span key={h} className="cal-hour" style={{ top: h * 60 }}>{`${String(h).padStart(2, "0")}:00`}</span>
          )))}
        </div>
        <div className="cal-day-col"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const id = e.dataTransfer.getData("text/task");
            if (!id) return;
            e.preventDefault();
            const task = [...timed, ...allday].find((x) => x.id === id);
            const [start] = timeFromDropY(e, e.currentTarget);
            updateTask(id, { date: t, timeStart: start, timeEnd: task ? shiftEnd(start, task) : null });
          }}
          onClick={(e) => {
            const el = e.target as HTMLElement;
            if (!el.classList.contains("cal-day-col")) return;
            const [start, total] = timeFromDropY(e, e.currentTarget);
            const endTotal = Math.min(24 * 60, total + 60);
            const created = addTask({
              title: "Новая задача", date: t, timeStart: start,
              timeEnd: `${String(Math.floor(endTotal / 60)).padStart(2, "0")}:${String(endTotal % 60).padStart(2, "0")}`,
            });
            onOpen(created);
          }}
        >
          {timed.map((task) => {
            const top = hourToY(task.timeStart!);
            const bottom = task.timeEnd ? hourToY(task.timeEnd) : top + 60;
            return (
              <div key={task.id} className="cal-event" style={{ top, height: Math.max(22, bottom - top) }}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/task", task.id)}
                onClick={(e) => { e.stopPropagation(); onOpen(task); }}>
                <TaskCheck task={task} />{task.title}
                <span className="ev-resize" onMouseDown={(e) => startEventResize(e, task, updateTask)} />
              </div>
            );
          })}
          {events.filter((e) => e.timeStart).map((e) => {
            const top = hourToY(e.timeStart!);
            const bottom = e.timeEnd ? hourToY(e.timeEnd) : top + 60;
            return (
              <div key={e.id} className="cal-event ghost" style={{ top, height: Math.max(22, bottom - top) }}>
                {e.title}
              </div>
            );
          })}
          <div className="now-line" style={{ top: nowY }} />
        </div>
      </div>
    </div>
  );
}

/* ---------------- Upcoming (week grid) ---------------- */

export function UpcomingView() {
  const { data, updateTask, addTask } = useStore();
  const [anchor, setAnchor] = useState(() => todayKey());
  const [span, setSpan] = useState<"D" | "4D" | "W" | "M">("W");
  const [mode, setMode] = useState<"cal" | "list">("cal");
  const [filterOpen, setFilterOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [planScope, setPlanScope] = useState<"all" | "unplanned">("all");
  const [showCompleted, setShowCompleted] = useState(true);
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS);
  const all = applyTaskFilters(useVisibleTasks(), filters);
  const [editing, setEditing] = useState<Task | null>(null);
  const t = todayKey();

  let days: string[];
  if (span === "D") {
    days = [anchor];
  } else if (span === "4D") {
    days = Array.from({ length: 4 }, (_, i) => addDays(anchor, i));
  } else if (span === "W") {
    days = weekDays(weekStart(anchor));
  } else {
    const d = fromKey(anchor);
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7;
    const startKey = addDays(toKey(first), -lead);
    days = Array.from({ length: 42 }, (_, i) => addDays(startKey, i));
  }

  const nav = (dir: number) => {
    if (span === "D") setAnchor(addDays(anchor, dir));
    else if (span === "4D") setAnchor(addDays(anchor, dir * 4));
    else if (span === "W") setAnchor(addDays(anchor, dir * 7));
    else {
      const d = fromKey(anchor);
      setAnchor(toKey(new Date(d.getFullYear(), d.getMonth() + dir, 1)));
    }
  };

  const visible = (x: Task) => showCompleted || !x.completedAt;
  const unplanned = all.filter((x) => !x.date && !x.completedAt);

  return (
    <>
      <div className="page-head">
        <div className="page-title">{monthLabel(days[Math.floor(days.length / 2)])}</div>
        <div className="spacer" />
        <div className="seg">
          <button className={mode === "list" ? "active" : ""} onClick={() => setMode("list")}><ListIconSmall /></button>
          <button className={mode === "cal" ? "active" : ""} onClick={() => setMode("cal")}><CalendarDay size={15} /></button>
        </div>
        <div className="seg">
          <button className={span === "D" ? "active" : ""} onClick={() => setSpan("D")}>Д</button>
          <button className={span === "4D" ? "active" : ""} onClick={() => setSpan("4D")}>4Д</button>
          <button className={span === "W" ? "active" : ""} onClick={() => setSpan("W")}>Н</button>
          <button className={span === "M" ? "active" : ""} onClick={() => setSpan("M")}>М</button>
        </div>
        <div className="pill-nav">
          <button onClick={() => nav(-1)}><ChevronLeft size={15} /></button>
          <button onClick={() => setAnchor(todayKey())}><span style={{ width: 7, height: 7, borderRadius: "50%", border: "1.5px solid currentColor", display: "block" }} /></button>
          <button onClick={() => nav(1)}><ChevronRight size={15} /></button>
        </div>
        <button className="btn-secondary" onClick={() => setPlanOpen(true)}>Планировать</button>
        <button className="icon-btn" onClick={() => setFilterOpen(true)}><FilterLines size={18} /></button>
        <button className="icon-btn" onClick={() => setSettingsOpen(true)}><Settings2 size={18} /></button>
      </div>

      {filterOpen && <FilterPopover onClose={() => setFilterOpen(false)} filters={filters} setFilters={setFilters} />}
      {settingsOpen && (
        <Pop onClose={() => setSettingsOpen(false)} style={{ top: 58, right: 16, width: 340 }}>
          <div className="pop-row" style={{ padding: "2px 0" }}>
            <div className="flabel" style={{ fontSize: 15 }}>Показывать выполненные</div>
            <Toggle on={showCompleted} onChange={setShowCompleted} />
          </div>
        </Pop>
      )}
      <div className="upcoming-split">
        <div className="upcoming-main">
      {span === "M" ? (
        <div className="month-wrap">
          <div className="mg-dows">{DAY_SHORT.map((d) => <span key={d}>{d}</span>)}</div>
          <div className="mg-grid">
            {days.map((d) => {
              const inMonth = fromKey(d).getMonth() === fromKey(anchor).getMonth();
              const dayTasks = all.filter((x) => x.date === d && visible(x));
              return (
                <div key={d} className={`mg-cell${inMonth ? "" : " out"}`}>
                  <span className={`mg-num${d === t ? " today" : ""}`}>{fromKey(d).getDate()}</span>
                  {dayTasks.slice(0, 3).map((x) => (
                    <div key={x.id} className="mg-task" onClick={() => setEditing(x)}>{x.title}</div>
                  ))}
                  {dayTasks.length > 3 && <div className="mg-more">ещё {dayTasks.length - 3}</div>}
                </div>
              );
            })}
          </div>
        </div>
      ) : mode === "list" ? (
        <div className="main-scroll">
          <div className="task-list">
            {days.map((d) => {
              const dayTasks = all.filter((x) => x.date === d && visible(x));
              return (
                <React.Fragment key={d}>
                  <div className="group-head">
                    <span className="group-title">{fmtHuman(d)}</span>
                    <span className="group-date">{fmtDayMon(d)}</span>
                    <span className="spacer" />
                  </div>
                  {dayTasks.length === 0
                    ? <div className="task-sub" style={{ padding: "6px 4px" }}>Нет задач</div>
                    : dayTasks.map((x) => <TaskRow key={x.id} task={x} onClick={() => setEditing(x)} />)}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="cal-wrap">
          <div className="cal-scroll"
            ref={(el) => { if (el && !el.dataset.scrolled) { el.dataset.scrolled = "1"; el.scrollTop = 14 * 60; } }}>
          <div className="cal-topbar">
          <div className="cal-head-row">
            <div className="cal-gutter" />
            {days.map((d) => {
              const dd = fromKey(d);
              return (
                <div key={d} className="cal-col-head">
                  {DAY_SHORT[dayOfWeekMon0(d)]}{" "}
                  <span className={`dnum${d === t ? " today" : ""}`}>{dd.getDate()}</span>
                </div>
              );
            })}
          </div>
          <div className="cal-allday">
            <div className="cal-allday-label">весь день</div>
            {days.map((d) => (
              <div key={d} className="cal-allday-col"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData("text/task");
                  if (!id) return;
                  e.preventDefault();
                  updateTask(id, { date: d, timeStart: null, timeEnd: null });
                }}>
                {(data.calendarEvents ?? []).filter((e) => e.date === d && !e.timeStart).map((e) => (
                  <div key={e.id} className="cal-event ghost" style={{ position: "static", marginBottom: 3 }}>{e.title}</div>
                ))}
                {all.filter((x) => x.date === d && !x.timeStart && visible(x)).map((x) => (
                  <div key={x.id} className="cal-event" style={{ position: "static", marginBottom: 3 }} onClick={() => setEditing(x)}>
                    <TaskCheck task={x} />{x.title}
                  </div>
                ))}
              </div>
            ))}
          </div>
          </div>
          <div className="cal-grid">
            <div className="cal-hours">
              {Array.from({ length: 24 }, (_, h) => (h === 0 ? null : (
                <span key={h} className="cal-hour" style={{ top: h * 60 }}>{`${String(h).padStart(2, "0")}:00`}</span>
              )))}
            </div>
            {days.map((d) => {
              const now = new Date();
              const nowY = (now.getHours() + now.getMinutes() / 60) * 60;
              return (
                <div key={d} className="cal-day-col"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const id = e.dataTransfer.getData("text/task");
                    if (!id) return;
                    e.preventDefault();
                    const task = all.find((x) => x.id === id);
                    if (!task) return;
                    const [start] = timeFromDropY(e, e.currentTarget);
                    updateTask(id, { date: d, timeStart: start, timeEnd: shiftEnd(start, task) });
                  }}
                  onClick={(e) => {
                    const el = e.target as HTMLElement;
                    if (!el.classList.contains("cal-day-col")) return;
                    const [start, total] = timeFromDropY(e, e.currentTarget);
                    const endTotal = Math.min(24 * 60, total + 60);
                    const created = addTask({
                      title: "Новая задача", date: d, timeStart: start,
                      timeEnd: `${String(Math.floor(endTotal / 60)).padStart(2, "0")}:${String(endTotal % 60).padStart(2, "0")}`,
                    });
                    setEditing(created);
                  }}
                >
                          {(data.calendarEvents ?? []).filter((e) => e.date === d && e.timeStart).map((e) => {
                    const top = hourToY(e.timeStart!);
                    const bottom = e.timeEnd ? hourToY(e.timeEnd) : top + 60;
                    return (
                      <div key={e.id} className="cal-event ghost" style={{ top, height: Math.max(22, bottom - top) }}>
                        {e.title}
                      </div>
                    );
                  })}
                  {all.filter((x) => x.date === d && x.timeStart && visible(x)).map((x) => {
                    const top = hourToY(x.timeStart!);
                    const bottom = x.timeEnd ? hourToY(x.timeEnd) : top + 60;
                    return (
                      <div key={x.id} className="cal-event" style={{ top, height: Math.max(22, bottom - top) }}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("text/task", x.id)}
                        onClick={(e) => { e.stopPropagation(); setEditing(x); }}>
                        <TaskCheck task={x} />{x.title}
                        <span className="ev-resize" onMouseDown={(e) => startEventResize(e, x, updateTask)} />
                      </div>
                    );
                  })}
                  {d === t && <div className="now-line" style={{ top: nowY }} />}
                </div>
              );
            })}
          </div>
          </div>
        </div>
      )}
        </div>
        {planOpen && (
          <div className="plan-panel">
            <div className="plan-head">
              <span className="plan-list-icon"><ListIcon size={17} /></span>
              <Dropdown trigger={
                <span className="plan-title">{planScope === "all" ? "Все задачи" : "Без даты"} <ChevronDown size={14} /></span>
              }>
                {(close) => (
                  <>
                    <MenuItem selected={planScope === "all"} onClick={() => { setPlanScope("all"); close(); }}>Все задачи</MenuItem>
                    <MenuItem selected={planScope === "unplanned"} onClick={() => { setPlanScope("unplanned"); close(); }}>Без даты</MenuItem>
                  </>
                )}
              </Dropdown>
              <span className="spacer" style={{ flex: 1 }} />
              <button className="icon-btn" title="Закрыть" onClick={() => setPlanOpen(false)}>✕</button>
            </div>
            <div className="plan-list">
              {(planScope === "all" ? all.filter((x) => !x.completedAt) : unplanned).map((x) => (
                <TaskRow key={x.id} task={x} onClick={() => setEditing(x)} />
              ))}
              <AddTask />
            </div>
          </div>
        )}
      </div>
      {editing && <TaskModal task={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function ChevronDownSmall() {
  return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>;
}
function ChevronUpSmall() {
  return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>;
}

function ListIconSmall() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
      <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </svg>
  );
}
