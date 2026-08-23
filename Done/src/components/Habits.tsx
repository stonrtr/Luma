"use client";

import React, { useState } from "react";
import { useStore, uid } from "@/lib/store";
import { Habit, Priority, Schedule } from "@/lib/types";
import {
  todayKey, addDays, weekStart, weekDays, fmtShort, DAY_LETTERS, DAY_FULL, DAY_SHORT,
  dayOfWeekMon0, toKey, fromKey, MONTHS_SHORT, daysBetween,
} from "@/lib/date";
import {
  Repeat, Plus, ChevronLeft, ChevronRight, Settings2, CheckSmall, ChartBars,
  CalendarDay, Clock, Flag, TagIcon, Bell, Bolt, ListIcon, InfoCircle, Trash, Pencil,
  Target, Check, Heart, Flame, AreaIcon, AREA_ICONS,
} from "./icons";
import { Modal, Select, Stepper, Toggle, Dropdown, MenuItem, Pop, InlineAdd } from "./ui";

export function habitActiveOn(h: Habit, date: string): boolean {
  if (date < h.startDate) return false;
  if (h.endDate && date > h.endDate) return false;
  if (h.schedule === "custom") return h.daysOfWeek.includes(dayOfWeekMon0(date));
  return true;
}

/** week completion: [done, target] */
export function habitWeekStats(
  h: Habit,
  logs: { habitId: string; date: string; count: number; status?: string | null }[],
  days: string[]
): [number, number] {
  let done = 0, target = 0;
  for (const d of days) {
    if (!habitActiveOn(h, d)) continue;
    const l = logs.find((x) => x.habitId === h.id && x.date === d);
    if (l?.status === "skipped" || l?.status === "moved") continue;
    target += h.timesPerDay;
    done += Math.min(h.timesPerDay, l?.count ?? 0);
  }
  return [done, target];
}

/** Стрик: сколько дней подряд привычка выполнена (неактивные/пропущенные дни не рвут серию, сегодня без отметки — тоже) */
export function habitStreak(
  h: Habit,
  logs: { habitId: string; date: string; count: number; status?: string | null }[]
): number {
  const t = todayKey();
  let streak = 0;
  let d = t;
  for (let i = 0; i < 3650; i++) {
    if (d < h.startDate) break;
    const log = logs.find((l) => l.habitId === h.id && l.date === d);
    if (!habitActiveOn(h, d) || log?.status === "skipped" || log?.status === "moved") {
      d = addDays(d, -1);
      continue;
    }
    const full = (log?.count ?? 0) >= h.timesPerDay;
    if (full) streak++;
    else if (d !== t) break;
    d = addDays(d, -1);
  }
  return streak;
}

/** Ввод значения для привычек с enterValue: prompt с заменой дневного счётчика */
export function promptHabitValue(h: Habit, current: number): number | null {
  const raw = window.prompt(`«${h.name}» — значение за день${h.timesPerDay > 1 ? ` (цель: ${h.timesPerDay})` : ""}`, current ? String(current) : "");
  if (raw === null) return null;
  const v = Number(raw.replace(",", "."));
  return Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
}

export function HabitsView() {
  const { data, logHabit, addHabit } = useStore();
  const [start, setStart] = useState(() => weekStart(todayKey()));
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [detail, setDetail] = useState<{ habit: Habit; tab: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "cards">("list");
  const days = weekDays(start);
  const t = todayKey();

  return (
    <>
      <div className="page-head">
        <div className="page-title">Мои привычки</div>
        <div className="spacer" />
        <div className="week-nav">
          <button className="wn-arrow" onClick={() => setStart(addDays(start, -7))}><ChevronLeft size={16} /></button>
          <span className="wn-label">{fmtShort(days[0])} - {fmtShort(days[6])}</span>
          <button className="wn-arrow" onClick={() => setStart(addDays(start, 7))}><ChevronRight size={16} /></button>
        </div>
        <div className="spacer" />
        <div className="seg">
          <button className={viewMode === "list" ? "active" : ""} onClick={() => setViewMode("list")}>
            <ListIcon size={15} />
          </button>
          <button className={viewMode === "cards" ? "active" : ""} onClick={() => setViewMode("cards")}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" /></svg>
          </button>
        </div>
        <button className="icon-btn" onClick={() => setSettingsOpen(true)}><Settings2 size={18} /></button>
      </div>

      {settingsOpen && (
        <Pop onClose={() => setSettingsOpen(false)} style={{ top: 58, right: 16, width: 340 }}>
          <div className="pop-row" style={{ padding: "2px 0" }}>
            <div className="flabel" style={{ fontSize: 15 }}>Показывать архивные</div>
            <Toggle on={showArchived} onChange={setShowArchived} />
          </div>
        </Pop>
      )}

      <div className="main-scroll" style={{ paddingTop: 6 }}>
        {data.habits.filter((h) => (showArchived || !h.archived) && h.showInHabits !== false).length === 0 && (
          <div className="empty-state" style={{ paddingTop: 140 }}>
            <div className="es-icon"><Repeat size={42} strokeWidth={1.2} /></div>
            <h3>Формируйте устойчивые привычки</h3>
            <p>Маленькие ежедневные действия со временем превращаются в большой результат.</p>
            <button className="btn-primary" onClick={() => setModal(true)}>Создать привычку</button>
          </div>
        )}
        {viewMode === "cards" ? (
          <div className="habit-cards">
            {data.habits.filter((h) => (showArchived || !h.archived) && h.showInHabits !== false).map((h) => {
              const [done, target] = habitWeekStats(h, data.habitLogs, days);
              const pct = target > 0 ? Math.round((done / target) * 100) : 0;
              const t2 = todayKey();
              return (
                <div key={h.id} className="habit-card" onClick={() => setDetail({ habit: h, tab: "Аналитика" })}>
                  <div className="hc-head">
                    <span className="h-icon">{h.icon ? <AreaIcon icon={h.icon} size={17} /> : <Repeat size={17} />}</span>
                    <span className="hc-name">{h.name}</span>
                    {habitStreak(h, data.habitLogs) > 0 && (
                      <span className="streak"><Flame size={13} /> {habitStreak(h, data.habitLogs)}</span>
                    )}
                  </div>
                  <div className="hc-sub">{pct}% · {done}/{target} на этой неделе</div>
                  <div className="hc-bars">
                    {days.map((d) => {
                      const c = data.habitLogs.find((l) => l.habitId === h.id && l.date === d)?.count ?? 0;
                      const f = Math.min(1, c / h.timesPerDay);
                      return (
                        <span key={d} className="hc-bar">
                          <span style={{ height: `${Math.max(6, f * 100)}%`, background: f > 0 ? "var(--accent)" : "#e8e8e8" }} />
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
        data.habits.filter((h) => (showArchived || !h.archived) && h.showInHabits !== false).map((h) => {
          const [done, target] = habitWeekStats(h, data.habitLogs, days);
          const pct = target > 0 ? Math.round((done / target) * 100) : 0;
          return (
            <div key={h.id} className="habit-row">
              <div className="habit-name" style={{ cursor: "pointer" }} onClick={() => setDetail({ habit: h, tab: "Настройки" })}>
                <span className="h-icon">{h.icon ? <AreaIcon icon={h.icon} size={17} /> : <Repeat size={17} />}</span>
                {h.name}
                {h.archived && <span className="head-meta" style={{ marginLeft: 8 }}>в архиве</span>}
                {habitStreak(h, data.habitLogs) > 0 && (
                  <span className="streak"><Flame size={13} /> {habitStreak(h, data.habitLogs)}</span>
                )}
              </div>
              <div className="habit-cells">
                {days.map((d) => {
                  const active = habitActiveOn(h, d);
                  const log = data.habitLogs.find((l) => l.habitId === h.id && l.date === d);
                  const count = log?.count ?? 0;
                  const status = log?.status;
                  const future = d > t;
                  if (!active) return <span key={d} className="hcell off" />;
                  if (future) {
                    return <span key={d} className="hcell future">{DAY_LETTERS[dayOfWeekMon0(d)]}</span>;
                  }
                  if (status === "moved") {
                    return (
                      <button key={d} className="hcell moved" title="Перенесено — нажмите, чтобы вернуть"
                        onClick={() => logHabit(h.id, d, 0)}>»</button>
                    );
                  }
                  if (status === "skipped") {
                    return (
                      <button key={d} className="hcell skip" title="Пропущено — нажмите, чтобы вернуть"
                        onClick={() => logHabit(h.id, d, 0)}>→</button>
                    );
                  }
                  if (status === "failed") {
                    return (
                      <button key={d} className="hcell fail" title="Провалено — нажмите, чтобы вернуть"
                        onClick={() => logHabit(h.id, d, 0)}>✕</button>
                    );
                  }
                  const full = count >= h.timesPerDay;
                  const frac = Math.min(1, count / h.timesPerDay);
                  return (
                    <button key={d}
                      className={`hcell ${full ? "done" : "plus"}`}
                      style={!full && count > 0 ? {
                        background: `linear-gradient(to top, var(--accent) ${frac * 100}%, var(--accent-softer) ${frac * 100}%)`,
                        color: "#fff",
                      } : undefined}
                      onClick={() => {
                        if (h.enterValue) {
                          const v = promptHabitValue(h, count);
                          if (v !== null) logHabit(h.id, d, v);
                        } else {
                          logHabit(h.id, d, full ? 0 : count + 1);
                        }
                      }}>
                      {h.enterValue && count > 0 ? count : full ? <CheckSmall size={12} /> : <Plus size={13} />}
                    </button>
                  );
                })}
                <span className="habit-pct"><HalfRing pct={pct} /> {pct}%</span>
                <button className="habit-stats-btn" onClick={() => setDetail({ habit: h, tab: "Аналитика" })}><ChartBars size={17} /></button>
              </div>
            </div>
          );
        })
        )}
        {data.habits.filter((h) => (showArchived || !h.archived) && h.showInHabits !== false).length > 0 && (
          <InlineAdd variant="card" placeholder="Добавить привычку" onAdd={(name) => addHabit({ name })} />
        )}
      </div>
      {modal && <HabitModal onClose={() => setModal(false)} />}
      {editing && <HabitModal habit={editing} onClose={() => setEditing(null)} />}
      {detail && <HabitDetailModal habitId={detail.habit.id} initialTab={detail.tab} onClose={() => setDetail(null)} />}
    </>
  );
}

export function HalfRing({ pct, size = 16 }: { pct: number; size?: number }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: "50%", display: "inline-block",
      border: "1.6px solid var(--text)",
      background: `conic-gradient(var(--text) ${pct * 3.6}deg, transparent 0)`,
    }} />
  );
}

export function HabitModal({ habit, onClose }: { habit?: Habit; onClose: () => void }) {
  const { data, addHabit, updateHabit, deleteHabit } = useStore();
  const t = todayKey();
  const [f, setF] = useState(() => ({
    name: habit?.name ?? "",
    schedule: habit?.schedule ?? ("daily" as Schedule),
    daysOfWeek: habit?.daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6],
    timesPerDay: habit?.timesPerDay ?? 1,
    enterValue: habit?.enterValue ?? false,
    startDate: habit?.startDate ?? t,
    timeOn: !!habit?.time,
    time: habit?.time ?? "09:00",
    endOn: !!habit?.endDate,
    endDate: habit?.endDate ?? "",
    linkTo: habit?.goalId ?? (habit?.areaId ? `a:${habit.areaId}` : ""),
    priority: habit?.priority ?? "",
    tagId: habit?.tagIds?.[0] ?? "",
    reminderOn: !!habit?.reminder,
    showInTasks: habit?.showInTasks ?? true,
    icon: habit?.icon ?? "",
  }));
  const goals = data.goals.filter((g) => !g.parentId);

  const save = () => {
    if (!f.name.trim()) return;
    const patch = {
      name: f.name.trim(),
      schedule: f.schedule,
      daysOfWeek: f.daysOfWeek,
      timesPerDay: Math.max(1, f.timesPerDay),
      enterValue: f.enterValue,
      startDate: f.startDate,
      time: f.timeOn ? f.time : null,
      endDate: f.endOn && f.endDate ? f.endDate : null,
      goalId: f.linkTo && !f.linkTo.startsWith("a:") ? f.linkTo : null,
      areaId: f.linkTo.startsWith("a:") ? f.linkTo.slice(2) : null,
      priority: (f.priority || null) as Priority | null,
      tagIds: f.tagId ? [f.tagId] : [],
      showInTasks: f.showInTasks,
      icon: f.icon || undefined,
      reminder: f.reminderOn ? "on" : null,
    };
    if (habit) updateHabit(habit.id, patch);
    else addHabit(patch);
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <div className="modal-scroll">
        <div className="modal-head">
          <Dropdown trigger={
            <span className="m-icon" title="Выбрать иконку">
              {f.icon ? <AreaIcon icon={f.icon} size={22} /> : <Repeat size={22} />}
            </span>
          }>
            {(close) => (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: 8, width: 200 }}>
                <button className="icon-btn" onClick={() => { setF({ ...f, icon: "" }); close(); }}><Repeat size={18} /></button>
                {Object.keys(AREA_ICONS).map((k) => (
                  <button key={k} className="icon-btn"
                    style={f.icon === k ? { background: "var(--accent-soft)", color: "var(--accent)" } : undefined}
                    onClick={() => { setF({ ...f, icon: k }); close(); }}>
                    <AreaIcon icon={k} size={18} />
                  </button>
                ))}
              </div>
            )}
          </Dropdown>
          <div className="m-titles">
            <input className="m-name" autoFocus placeholder="Название привычки" value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
        </div>

        <div className="frow">
          <div className="flabel"><span className="fic"><Repeat size={17} /></span>Расписание</div>
          <div className="fctrl">
            <Select value={f.schedule} onChange={(v) => setF({ ...f, schedule: v as Schedule })}>
              <option value="daily">Каждый день</option>
              <option value="custom">Выбранные дни</option>
            </Select>
          </div>
        </div>
        {f.schedule === "custom" && (
          <div className="frow">
            <div className="flabel" />
            <div className="fctrl" style={{ gap: 5 }}>
              {DAY_LETTERS.map((l, i) => (
                <button key={i} type="button"
                  className="hcell"
                  style={{
                    background: f.daysOfWeek.includes(i) ? "var(--accent)" : "#f0f0f0",
                    color: f.daysOfWeek.includes(i) ? "#fff" : "#7c7c7c",
                  }}
                  onClick={() => setF({
                    ...f,
                    daysOfWeek: f.daysOfWeek.includes(i)
                      ? f.daysOfWeek.filter((x) => x !== i)
                      : [...f.daysOfWeek, i],
                  })}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="frow">
          <div className="flabel"><span className="fic"><CheckSmall size={15} strokeWidth={2} /></span>Выполнять</div>
          <div className="fctrl">
            <Stepper value={f.timesPerDay} min={1} onChange={(v) => setF({ ...f, timesPerDay: v })} />
            <span style={{ fontSize: 14, color: "#3d3d3d" }}>раз в день</span>
          </div>
        </div>
        <div className="frow">
          <div className="flabel">
            <span className="fic"><Pencil size={16} /></span>Ввод значения
            <InfoCircle size={14} className="muted" />
          </div>
          <div className="fctrl"><Toggle on={f.enterValue} onChange={(v) => setF({ ...f, enterValue: v })} /></div>
        </div>

        <div className="fsep" />

        <div className="frow">
          <div className="flabel"><span className="fic"><CalendarDay size={17} /></span>Дата начала</div>
          <div className="fctrl">
            <input type="date" className="finput" value={f.startDate}
              onChange={(e) => setF({ ...f, startDate: e.target.value })} />
          </div>
        </div>
        <div className="frow">
          <div className="flabel"><span className="fic"><Clock size={17} /></span>Время</div>
          <div className="fctrl">
            <Toggle on={f.timeOn} onChange={(v) => setF({ ...f, timeOn: v })} />
            {f.timeOn && <input type="time" className="finput" style={{ width: 120 }} value={f.time}
              onChange={(e) => setF({ ...f, time: e.target.value })} />}
          </div>
        </div>
        <div className="frow">
          <div className="flabel"><span className="fic"><CalendarDay size={17} /></span>Дата окончания</div>
          <div className="fctrl">
            <Toggle on={f.endOn} onChange={(v) => setF({ ...f, endOn: v })} />
            {f.endOn && <input type="date" className="finput" value={f.endDate}
              onChange={(e) => setF({ ...f, endDate: e.target.value })} />}
          </div>
        </div>

        <div className="fsep" />

        <div className="frow">
          <div className="flabel"><span className="fic"><Bolt size={17} /></span>Привязать к</div>
          <div className="fctrl">
            <Select value={f.linkTo} placeholder="Выбрать" onChange={(v) => setF({ ...f, linkTo: v })}>
              <optgroup label="Цели">
                {goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </optgroup>
              <optgroup label="Сферы жизни">
                {data.areas.map((a) => <option key={a.id} value={`a:${a.id}`}>{a.name}</option>)}
              </optgroup>
            </Select>
          </div>
        </div>

        <div className="frow" style={{ marginTop: 8 }}>
          <div className="flabel"><span className="fic"><Flag size={17} /></span>Приоритет</div>
          <div className="fctrl">
            <Select value={f.priority} placeholder="Выбрать" onChange={(v) => setF({ ...f, priority: v })}>
              <option value="High">Высокий</option><option value="Medium">Средний</option><option value="Low">Низкий</option>
            </Select>
          </div>
        </div>
        <div className="frow">
          <div className="flabel"><span className="fic"><TagIcon size={17} /></span>Теги</div>
          <div className="fctrl">
            <Select value={f.tagId} placeholder="Выбрать" onChange={(v) => setF({ ...f, tagId: v })}>
              {data.tags.map((tg) => <option key={tg.id} value={tg.id}>{tg.name}</option>)}
            </Select>
          </div>
        </div>
        <div className="frow">
          <div className="flabel"><span className="fic"><Bell size={17} /></span>Напоминание</div>
          <div className="fctrl"><Toggle on={f.reminderOn} onChange={(v) => {
            if (v && typeof Notification !== "undefined" && Notification.permission === "default") {
              Notification.requestPermission();
            }
            setF({ ...f, reminderOn: v });
          }} /></div>
        </div>
        <div className="frow">
          <div className="flabel"><span className="fic"><ListIcon size={17} /></span>Показывать в списках задач</div>
          <div className="fctrl"><Toggle on={f.showInTasks} onChange={(v) => setF({ ...f, showInTasks: v })} /></div>
        </div>
      </div>
      <div className="modal-foot">
        {habit && (
          <button className="btn-ghost" style={{ marginRight: "auto", color: "#e5484d" }}
            onClick={() => {
              if (window.confirm(`Удалить привычку «${habit.name}» вместе с историей выполнения?`)) {
                deleteHabit(habit.id);
                onClose();
              }
            }}>
            <Trash size={15} />
          </button>
        )}
        <button className="btn-ghost" onClick={onClose}>Отмена</button>
        <button className="btn-primary" onClick={save}>Сохранить</button>
      </div>
    </Modal>
  );
}


/* ================= Habit detail modal ================= */

type HdTab = "Аналитика" | "Ближайшие" | "Настройки";
type HdPeriod = "W" | "M" | "Q" | "Y";
const HD_PERIOD_RU: Record<HdPeriod, string> = { W: "Н", M: "М", Q: "К", Y: "Г" };

function periodDays(p: HdPeriod, offset: number): string[] {
  const now = new Date();
  let start: string, end: string;
  if (p === "W") {
    start = addDays(weekStart(todayKey()), offset * 7);
    end = addDays(start, 6);
  } else if (p === "M") {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    start = toKey(d);
    end = toKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  } else if (p === "Q") {
    const q = Math.floor(now.getMonth() / 3) + offset;
    const d = new Date(now.getFullYear(), q * 3, 1);
    start = toKey(d);
    end = toKey(new Date(d.getFullYear(), d.getMonth() + 3, 0));
  } else {
    const d = new Date(now.getFullYear() + offset, 0, 1);
    start = toKey(d);
    end = toKey(new Date(d.getFullYear(), 11, 31));
  }
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}

export function HabitDetailModal({ habitId, initialTab, onClose }: {
  habitId: string; initialTab?: string; onClose: () => void;
}) {
  const { data, updateHabit, deleteHabit, logHabit } = useStore();
  const habit = data.habits.find((h) => h.id === habitId);
  const [tab, setTab] = useState<HdTab>((initialTab as HdTab) ?? "Настройки");
  const t = todayKey();
  if (!habit) return null;

  const todayLog = data.habitLogs.find((l) => l.habitId === habit.id && l.date === t);
  const count = todayLog?.count ?? 0;
  const status = todayLog?.status ?? null;
  const full = count >= habit.timesPerDay;

  return (
    <Modal onClose={onClose} width={960}>
      <div className="hd-modal">
        <div className="hd-left">
          <button className="icon-btn hd-close" onClick={onClose}>✕</button>
          <div className="hd-title-row">
            {status ? (
              <button className={`st-ico ${status}`} style={{ width: 22, height: 22, marginTop: 0 }}
                title="Нажмите, чтобы вернуть"
                onClick={() => logHabit(habit.id, t, 0)}>
                {status === "moved" ? "»" : status === "skipped" ? "→" : "✕"}
              </button>
            ) : (
              <button
                className={`task-check habit${full ? " done" : ""}`}
                style={{
                  width: 20, height: 20,
                  ...(!full && count > 0 ? {
                    background: `conic-gradient(var(--accent) ${(count / habit.timesPerDay) * 360}deg, #fff 0)`,
                    borderColor: "var(--accent)",
                  } : {}),
                }}
                onClick={() => {
                  if (habit.enterValue) {
                    const v = promptHabitValue(habit, count);
                    if (v !== null) logHabit(habit.id, t, v);
                  } else {
                    logHabit(habit.id, t, full ? 0 : count + 1);
                  }
                }}
              >
                {full && <CheckSmall size={11} />}
              </button>
            )}
            <input className="hd-name" value={habit.name}
              onChange={(e) => updateHabit(habit.id, { name: e.target.value })} />
          </div>
          <div className="hd-sub">
            {status === "moved"
              ? (todayLog?.movedTo === addDays(t, 1) ? "Завтра" : todayLog?.movedTo ?? "Перенесено")
              : "Сегодня"}
            {status === "skipped" && " · пропущено"}
            {status === "failed" && " · провалено"}
          </div>
          <div className="hd-chips">
            <Dropdown trigger={
              <span className={`btn-secondary${status === "moved" ? " on" : ""}`}>
                <CalendarDay size={14} /> Перенести
              </span>
            }>
              {(close) => (
                <>
                  <MenuItem onClick={() => { logHabit(habit.id, t, 0, "moved", addDays(t, 1)); close(); }}>На завтра</MenuItem>
                  <MenuItem onClick={() => { logHabit(habit.id, t, 0, "moved", addDays(t, 7)); close(); }}>Через неделю</MenuItem>
                  {status === "moved" && (
                    <MenuItem onClick={() => { logHabit(habit.id, t, 0); close(); }}>Вернуть на сегодня</MenuItem>
                  )}
                </>
              )}
            </Dropdown>
            <button className={`btn-secondary${status === "skipped" ? " on" : ""}`}
              onClick={() => logHabit(habit.id, t, 0, status === "skipped" ? null : "skipped")}>
              → Пропустить
            </button>
            <button className={`btn-secondary${status === "failed" ? " on" : ""}`}
              onClick={() => logHabit(habit.id, t, 0, status === "failed" ? null : "failed")}>
              ✕ Провалить
            </button>
          </div>
          <input className="hd-desc" placeholder="Описание" value={habit.notes ?? ""}
            onChange={(e) => updateHabit(habit.id, { notes: e.target.value })} />
          <HabitSubtasks habit={habit} />
        </div>

        <div className="hd-right">
          <div className="hd-tabs">
            {(["Аналитика", "Ближайшие", "Настройки"] as HdTab[]).map((x) => (
              <button key={x} className={tab === x ? "active" : ""} onClick={() => setTab(x)}>{x}</button>
            ))}
          </div>
          {tab === "Настройки" && <HdSettings habit={habit} onClose={onClose} />}
          {tab === "Ближайшие" && <HdUpcoming habit={habit} />}
          {tab === "Аналитика" && <HdInsights habit={habit} />}
        </div>
      </div>
    </Modal>
  );
}

function HabitSubtasks({ habit }: { habit: Habit }) {
  const { updateHabit } = useStore();
  const [text, setText] = useState("");
  const subtasks = habit.subtasks ?? [];
  const save = (next: typeof subtasks) => updateHabit(habit.id, { subtasks: next });
  const add = () => {
    const v = text.trim();
    if (!v) return;
    save([...subtasks, { id: uid(), title: v, done: false }]);
    setText("");
  };
  return (
    <div style={{ marginLeft: 34 }}>
      {subtasks.map((st) => (
        <div key={st.id} className="task-row" style={{ padding: "5px 0" }}>
          <button className={`task-check${st.done ? " done" : ""}`} style={{ width: 16, height: 16 }}
            onClick={() => save(subtasks.map((x) => (x.id === st.id ? { ...x, done: !x.done } : x)))}>
            {st.done && <CheckSmall size={9} />}
          </button>
          <div className="task-body">
            <div className={`task-title${st.done ? " done" : ""}`} style={{ fontSize: 14 }}>{st.title}</div>
          </div>
          <button className="icon-btn" style={{ width: 24, height: 24 }}
            onClick={() => save(subtasks.filter((x) => x.id !== st.id))}>
            <Trash size={13} />
          </button>
        </div>
      ))}
      <div className="add-task" style={{ padding: "5px 0" }}>
        <span className="task-check" style={{ borderStyle: "dashed", width: 16, height: 16 }} />
        <input placeholder="Подзадача" value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          onBlur={add} />
      </div>
    </div>
  );
}

/* ---------- Settings tab ---------- */

function HdSettings({ habit, onClose }: { habit: Habit; onClose: () => void }) {
  const { data, updateHabit, deleteHabit } = useStore();
  const t = todayKey();

  const linked = habit.goalId
    ? data.goals.find((g) => g.id === habit.goalId)?.name
    : habit.areaId
      ? data.areas.find((a) => a.id === habit.areaId)?.name
      : null;

  const schedLabel = habit.schedule === "daily"
    ? "Каждый день"
    : habit.daysOfWeek.length === 7 ? "Каждый день" : habit.daysOfWeek.map((i) => DAY_SHORT[i]).join(", ");
  const schedSub = `${habit.timesPerDay} раз${habit.timesPerDay === 1 ? "" : habit.timesPerDay < 5 ? "а" : ""} в день, ${habit.time ? habit.time : "Весь день"}`;

  const PR: Record<string, string> = { High: "Высокий", Medium: "Средний", Low: "Низкий" };

  return (
    <div>
      <Dropdown trigger={
        <div className="hd-row click" style={{ color: linked ? undefined : "#9a9a9a" }}>
          <span className="fic"><Target size={17} /></span>
          <span className="hd-val">{linked ?? "Цель или сфера жизни"}</span>
        </div>
      }>
        {(close) => (
          <>
            {data.goals.filter((g) => !g.parentId).map((g) => (
              <MenuItem key={g.id} selected={habit.goalId === g.id}
                onClick={() => { updateHabit(habit.id, { goalId: g.id, areaId: null }); close(); }}>{g.name}</MenuItem>
            ))}
            {data.areas.map((a) => (
              <MenuItem key={a.id} selected={habit.areaId === a.id}
                onClick={() => { updateHabit(habit.id, { areaId: a.id, goalId: null }); close(); }}>
                <span className="cbar" style={{ background: a.color }} />{a.name}
              </MenuItem>
            ))}
            <MenuItem selected={!habit.goalId && !habit.areaId}
              onClick={() => { updateHabit(habit.id, { goalId: null, areaId: null }); close(); }}>Без привязки</MenuItem>
          </>
        )}
      </Dropdown>

      <Dropdown trigger={
        <div className="hd-row click">
          <span className="fic"><Repeat size={17} /></span>
          <span className="hd-val">
            {schedLabel}
            <div className="hv-sub">{schedSub}</div>
          </span>
        </div>
      } width={260}>
        {(close) => (
          <>
            <MenuItem selected={habit.schedule === "daily"}
              onClick={() => updateHabit(habit.id, { schedule: "daily", daysOfWeek: [0, 1, 2, 3, 4, 5, 6] })}>
              Каждый день
            </MenuItem>
            <MenuItem selected={habit.schedule === "custom"}
              onClick={() => updateHabit(habit.id, { schedule: "custom" })}>
              Выбранные дни
            </MenuItem>
            {habit.schedule === "custom" && (
              <div className="menu-inp" style={{ display: "flex", gap: 4 }}>
                {DAY_LETTERS.map((l, i) => (
                  <button key={i} type="button" className="hcell"
                    style={{
                      background: habit.daysOfWeek.includes(i) ? "var(--accent)" : "#f0f0f0",
                      color: habit.daysOfWeek.includes(i) ? "#fff" : "#7c7c7c",
                    }}
                    onClick={() => updateHabit(habit.id, {
                      daysOfWeek: habit.daysOfWeek.includes(i)
                        ? habit.daysOfWeek.filter((x) => x !== i)
                        : [...habit.daysOfWeek, i],
                    })}>
                    {l}
                  </button>
                ))}
              </div>
            )}
            <div className="menu-label">Раз в день</div>
            <div className="menu-inp">
              <Stepper value={habit.timesPerDay} min={1}
                onChange={(v) => updateHabit(habit.id, { timesPerDay: Math.max(1, v) })} />
            </div>
          </>
        )}
      </Dropdown>

      <Dropdown trigger={
        <div className="hd-row click" style={{ color: habit.priority ? undefined : "#9a9a9a" }}>
          <span className="fic"><InfoCircle size={17} /></span>
          <span className="hd-val">{habit.priority ? PR[habit.priority] : "Приоритет"}</span>
        </div>
      }>
        {(close) => (
          <>
            {(["High", "Medium", "Low"] as const).map((pr) => (
              <MenuItem key={pr} selected={habit.priority === pr}
                onClick={() => { updateHabit(habit.id, { priority: pr }); close(); }}>{PR[pr]}</MenuItem>
            ))}
            <MenuItem selected={!habit.priority}
              onClick={() => { updateHabit(habit.id, { priority: null }); close(); }}>Нет</MenuItem>
          </>
        )}
      </Dropdown>

      <div className="hd-row muted">
        <span className="fic"><TagIcon size={17} /></span>
        <span className="hd-val">Теги</span>
      </div>

      <div className="hd-row">
        <span className="fic"><Bell size={17} /></span>
        <span className="hd-val">
          {habit.time ? `В этот день (${habit.time})` : "В течение дня"}
          <div className="hv-sub" style={{ color: "#9a9a9a" }}>Добавить напоминание</div>
        </span>
      </div>

      <div className="hd-row muted">
        <span className="fic"><Repeat size={17} /></span>
        <span className="hd-val">Иконка</span>
        <span className="icon-btn" style={{ background: "#fff", borderRadius: 10, cursor: "default" }}><Repeat size={15} /></span>
      </div>

      <div className="hd-sep" />

      <div className="hd-row">
        <span className="fic"><Pencil size={17} /></span>
        <span className="hd-val">Ввод значения <InfoCircle size={13} className="muted" /></span>
        <Toggle on={habit.enterValue} onChange={(v) => updateHabit(habit.id, { enterValue: v })} />
      </div>
      <div className="hd-row">
        <span className="fic"><Repeat size={17} /></span>
        <span className="hd-val">Показывать в списке привычек</span>
        <Toggle on={habit.showInHabits !== false} onChange={(v) => updateHabit(habit.id, { showInHabits: v })} />
      </div>
      <div className="hd-row">
        <span className="fic"><ListIcon size={17} /></span>
        <span className="hd-val">Показывать в списках задач</span>
        <Toggle on={habit.showInTasks} onChange={(v) => updateHabit(habit.id, { showInTasks: v })} />
      </div>

      <div className="hd-sep" />

      <button className="hd-row click" onClick={() => { updateHabit(habit.id, { endDate: t }); onClose(); }}>
        <span className="fic"><Check size={17} /></span>
        <span className="hd-val">Завершить навсегда</span>
      </button>

      <div className="hd-sep" />

      <button className="hd-row click" onClick={() => { updateHabit(habit.id, { archived: !habit.archived }); onClose(); }}>
        <span className="fic"><CalendarDay size={17} /></span>
        <span className="hd-val">{habit.archived ? "Вернуть из архива" : "Архивировать"}</span>
      </button>
      <button className="hd-row click danger" onClick={() => {
        if (window.confirm(`Удалить привычку «${habit.name}» вместе с историей выполнения?`)) {
          deleteHabit(habit.id);
          onClose();
        }
      }}>
        <span className="fic"><Trash size={17} /></span>
        <span className="hd-val">Удалить</span>
      </button>
    </div>
  );
}

/* ---------- Upcoming tab ---------- */

function HdUpcoming({ habit }: { habit: Habit }) {
  const { data, logHabit, addHabit } = useStore();
  const t = todayKey();
  const thisWeek = weekDays(weekStart(t)).filter((d) => habitActiveOn(habit, d));
  const nextWeek = weekDays(addDays(weekStart(t), 7)).filter((d) => habitActiveOn(habit, d));

  const label = (d: string) => {
    if (d === t) return "Сегодня";
    if (d === addDays(t, 1)) return "Завтра";
    return DAY_FULL[dayOfWeekMon0(d)];
  };

  return (
    <div>
      <div className="hd-section-title">Эта неделя</div>
      <div className="hd-card" style={{ padding: "4px 16px" }}>
        {thisWeek.map((d) => {
          const count = data.habitLogs.find((l) => l.habitId === habit.id && l.date === d)?.count ?? 0;
          const full = count >= habit.timesPerDay;
          const past = d < t;
          const missed = past && !full;
          return (
            <div key={d} className="up-row">
              <button
                className={`up-check${full ? " done" : ""}${d > t ? " round" : ""}`}
                style={!full && count > 0 ? {
                  background: `conic-gradient(var(--accent) ${(count / habit.timesPerDay) * 360}deg, #fff 0)`,
                  borderColor: "var(--accent)",
                } : undefined}
                onClick={() => d <= t && logHabit(habit.id, d, full ? 0 : count + 1)}
              >
                {full && <CheckSmall size={11} />}
              </button>
              <span className={`up-label${missed ? " missed" : ""}${d === t ? " today" : ""}`}>{label(d)}</span>
              <span className="up-meta">{habit.time ?? "Весь день"}</span>
              {d <= t ? (
                <Dropdown align="right" trigger={<span className="muted" style={{ cursor: "pointer", padding: "0 4px" }}>⋯</span>}>
                  {(close) => {
                    const log = data.habitLogs.find((l) => l.habitId === habit.id && l.date === d);
                    return (
                      <>
                        <MenuItem selected={(log?.count ?? 0) >= habit.timesPerDay && !log?.status}
                          onClick={() => { logHabit(habit.id, d, habit.timesPerDay); close(); }}>Выполнено</MenuItem>
                        <MenuItem selected={log?.status === "skipped"}
                          onClick={() => { logHabit(habit.id, d, 0, "skipped"); close(); }}>Пропущено</MenuItem>
                        <MenuItem selected={log?.status === "failed"}
                          onClick={() => { logHabit(habit.id, d, 0, "failed"); close(); }}>Провалено</MenuItem>
                        <MenuItem selected={!log}
                          onClick={() => { logHabit(habit.id, d, 0); close(); }}>Сбросить</MenuItem>
                      </>
                    );
                  }}
                </Dropdown>
              ) : (
                <span className="muted">⋯</span>
              )}
            </div>
          );
        })}
        <button className="up-add" style={{ width: "100%", textAlign: "left" }}
          onClick={() => {
            const c = data.habitLogs.find((l) => l.habitId === habit.id && l.date === t)?.count ?? 0;
            logHabit(habit.id, t, c + 1);
          }}>
          <Plus size={15} /> Доп. повторение (сегодня: {data.habitLogs.find((l) => l.habitId === habit.id && l.date === t)?.count ?? 0})
        </button>
      </div>

      <div className="hd-section-title">Следующая неделя</div>
      <div className="hd-card" style={{ padding: "4px 16px" }}>
        {nextWeek.map((d) => (
          <div key={d} className="up-row">
            <span className="fic" style={{ color: "#8a8a8a", display: "flex" }}><CalendarDay size={17} /></span>
            <span className="up-label">{label(d)}</span>
            <span className="up-meta">{habit.time ?? "Весь день"}</span>
            <span className="muted">⋯</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Insights tab ---------- */

function HdInsights({ habit }: { habit: Habit }) {
  const { data } = useStore();
  const [period, setPeriod] = useState<HdPeriod>("W");
  const [offset, setOffset] = useState(0);
  const t = todayKey();
  const days = periodDays(period, offset);

  let done = 0, target = 0, skipped = 0, failed = 0;
  const logOf = (d: string) => data.habitLogs.find((l) => l.habitId === habit.id && l.date === d);
  const countOf = (d: string) => logOf(d)?.count ?? 0;
  for (const d of days) {
    if (!habitActiveOn(habit, d)) continue;
    const st = logOf(d)?.status;
    if (st === "skipped" || st === "moved") { skipped++; continue; }
    if (st === "failed") failed++;
    target += habit.timesPerDay;
    done += Math.min(habit.timesPerDay, countOf(d));
  }
  const rate = target > 0 ? Math.round((done / target) * 100) : 0;

  // идеальные недели: каждая активная ячейка недели закрыта, неделя целиком в диапазоне
  let perfect = 0;
  for (let ws = weekStart(days[0]); ws <= days[days.length - 1]; ws = addDays(ws, 7)) {
    const wd = weekDays(ws).filter((d) => habitActiveOn(habit, d));
    if (wd.length === 0) continue;
    if (wd.every((d) => d >= days[0] && d <= days[days.length - 1] && countOf(d) >= habit.timesPerDay)) perfect++;
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <div className="seg" style={{ flex: 1 }}>
          {(["W", "M", "Q", "Y"] as HdPeriod[]).map((x) => (
            <button key={x} style={{ flex: 1 }} className={period === x ? "active" : ""}
              onClick={() => { setPeriod(x); setOffset(0); }}>
              {HD_PERIOD_RU[x]}
            </button>
          ))}
        </div>
        <div className="pill-nav">
          <button onClick={() => setOffset(offset - 1)}><ChevronLeft size={14} /></button>
          <button onClick={() => setOffset(0)}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", border: "1.5px solid currentColor", display: "block" }} />
          </button>
          <button onClick={() => setOffset(offset + 1)}><ChevronRight size={14} /></button>
        </div>
      </div>

      <div className="hd-section-title" style={{ marginTop: 0 }}>Статистика</div>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Выполнено</div>
          <div className="stat-num">{done} <span>/ {target}</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Процент выполнения</div>
          <div className="stat-num">{rate}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Идеальные недели</div>
          <div className="stat-num">{perfect}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Пропущено</div>
          <div className="stat-num">{skipped}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Провалено</div>
          <div className="stat-num">{failed}</div>
        </div>
      </div>

      {period === "W" ? (
        <>
          <div className="hd-section-title">Эта неделя</div>
          <div className="hd-card">
            <div className="stat-num" style={{ marginBottom: 8 }}>{done} <span>/ {target}</span></div>
            <HdWeekBars habit={habit} days={days} countOf={countOf} />
          </div>
        </>
      ) : (
        <>
          <div className="hd-section-title">Календарь</div>
          <HdMonthCalendars habit={habit} days={days} countOf={countOf} />
        </>
      )}
    </div>
  );
}

function HdWeekBars({ habit, days, countOf }: { habit: Habit; days: string[]; countOf: (d: string) => number }) {
  const max = Math.max(habit.timesPerDay, 1);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", height: 90, borderBottom: "1px solid #eee" }}>
        {days.map((d) => {
          const v = habitActiveOn(habit, d) ? Math.min(countOf(d), max) : 0;
          return (
            <div key={d} style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "flex-end", height: "100%" }}>
              <div style={{ width: 7, borderRadius: 4, height: "100%", background: "#f0f0f0", position: "relative" }}>
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0, borderRadius: 4,
                  height: `${(v / max) * 100}%`, background: "var(--accent)",
                }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", marginTop: 4 }}>
        {days.map((d) => (
          <span key={d} style={{ flex: 1, textAlign: "center", fontSize: 12, color: "#9a9a9a" }}>
            {DAY_LETTERS[dayOfWeekMon0(d)]}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Календарь по месяцам внутри диапазона */
function HdMonthCalendars({ habit, days, countOf }: { habit: Habit; days: string[]; countOf: (d: string) => number }) {
  const t = todayKey();
  const months = new Map<string, string[]>();
  for (const d of days) {
    const key = d.slice(0, 7);
    if (!months.has(key)) months.set(key, []);
    months.get(key)!.push(d);
  }
  return (
    <>
      {[...months.entries()].map(([mk, mdays]) => {
        const first = fromKey(mdays[0]);
        const m = first.getMonth();
        let done = 0, target = 0;
        for (const d of mdays) {
          if (!habitActiveOn(habit, d)) continue;
          target += habit.timesPerDay;
          done += Math.min(habit.timesPerDay, countOf(d));
        }
        const rate = target > 0 ? Math.round((done / target) * 100) : 0;
        const lead = dayOfWeekMon0(mdays[0]);
        return (
          <div key={mk} className="hd-card" style={{ marginBottom: 12 }}>
            <div className="hm-head">
              <span className="hm-title">{MONTHS_SHORT[m][0].toUpperCase() + MONTHS_SHORT[m].slice(1)}</span>
              <span className="hm-stats">
                <span>✓ {done}</span><span>{rate}%</span>
              </span>
            </div>
            <div className="hm-grid">
              {DAY_LETTERS.map((l, i) => <span key={i} className="hm-dow">{l}</span>)}
              {Array.from({ length: lead }, (_, i) => <span key={`e${i}`} />)}
              {mdays.map((d) => {
                const c = countOf(d);
                const full = c >= habit.timesPerDay;
                const part = c > 0 && !full;
                return (
                  <span key={d} className="hm-day">
                    <span className={`d${full ? " done" : part ? " part" : ""}${d === t ? " today" : ""}${!habitActiveOn(habit, d) ? " out" : ""}`}>
                      {fromKey(d).getDate()}
                    </span>
                    {c > 1 && <span className="badge-n">{c}</span>}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
