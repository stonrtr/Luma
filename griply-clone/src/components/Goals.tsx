"use client";

import React, { useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { Goal, Habit, HabitLog, Impact, Metric, Task, View } from "@/lib/types";
import { PALETTE } from "@/lib/colors";
import { todayKey, addDays, fmtDayMon, fmtShort, timeLeft, timeLeftLong, daysBetween, weekStart, fromKey, toKey } from "@/lib/date";
import {
  Target, Plus, Dots, FilterLines, Settings2, ChevronRight, ChevronDown, ArrowLeft,
  Star, Heart, Bolt, CalendarDay, Flag, ChartBars, InfoCircle, Search, MapPin, Check, LineChart, Pencil, Trash, ListIcon,
} from "./icons";
import { Modal, Select, Stepper, Toggle, Dropdown, MenuItem, DateMenu, Pop, PSel } from "./ui";
import { AddTask, TaskRow, TaskModal } from "./TaskViews";
import { AreaIcon, AREA_ICONS } from "./icons";

/* ------------ helpers ------------ */

const IMPACT_RU: Record<string, string> = { High: "Высокое", Medium: "Среднее", Low: "Низкое" };

export function goalColor(g: Goal, areas: { id: string; color: string }[]): string {
  if (g.color) return g.color;
  const a = areas.find((x) => x.id === g.areaId);
  return a?.color ?? "#6e6ade";
}

/** Прогресс цели: числовая метрика — по формуле, иначе каждая выполненная
 *  задача и каждый выполненный день привычки, привязанных к цели, дают +1%. */
export function goalProgress(
  g: Goal,
  d: { tasks: Task[]; habits: Habit[]; habitLogs: HabitLog[] }
): number {
  if (g.metric === "numeric" && g.targetValue !== g.startValue) {
    return Math.min(100, Math.max(0, Math.round(((g.currentValue - g.startValue) / (g.targetValue - g.startValue)) * 100)));
  }
  const doneTasks = d.tasks.filter((t) => t.goalId === g.id && !t.deletedAt && !!t.completedAt).length;
  const linkedHabits = d.habits.filter((h) => h.goalId === g.id);
  let habitDays = 0;
  for (const h of linkedHabits) {
    habitDays += d.habitLogs.filter((l) => l.habitId === h.id && l.count >= h.timesPerDay).length;
  }
  return Math.min(100, doneTasks + habitDays);
}

/** История прогресса по дням: кумулятивные +1% за задачи (по completedAt)
 *  и полные дни привязанных привычек. Возвращает точки [доля времени 0..1, %]. */
export function goalHistory(
  g: Goal,
  d: { tasks: Task[]; habits: Habit[]; habitLogs: HabitLog[] },
  rangeStart?: string,
  rangeEnd?: string
): { x: number; y: number }[] {
  const start = rangeStart ?? g.startDate ?? todayKey();
  const end = rangeEnd ?? g.deadline ?? addDays(start, 30);
  const total = Math.max(1, daysBetween(start, end));
  if (g.metric === "numeric") {
    const log = [...(g.progressLog ?? [])].sort((a, b) => (a.date < b.date ? -1 : 1));
    if (log.length === 0) return [];
    const span = g.targetValue - g.startValue;
    if (!span) return [];
    const pts: { x: number; y: number }[] = [{ x: 0, y: 0 }];
    for (const e of log) {
      const y = Math.min(100, Math.max(0, Math.round(((e.value - g.startValue) / span) * 100)));
      const x = Math.min(1, Math.max(0, daysBetween(start, e.date) / total));
      pts.push({ x, y });
    }
    const nowX = Math.min(1, Math.max(0, daysBetween(start, todayKey()) / total));
    pts.push({ x: nowX, y: pts[pts.length - 1].y });
    return pts;
  }
  const events: string[] = [];
  for (const t of d.tasks) {
    if (t.goalId === g.id && !t.deletedAt && t.completedAt) events.push(t.completedAt.slice(0, 10));
  }
  for (const h of d.habits.filter((h) => h.goalId === g.id)) {
    for (const l of d.habitLogs) {
      if (l.habitId === h.id && l.count >= h.timesPerDay) events.push(l.date);
    }
  }
  events.sort();
  const pts: { x: number; y: number }[] = [{ x: 0, y: 0 }];
  let y = 0;
  for (const e of events) {
    y = Math.min(100, y + 1);
    const x = Math.min(1, Math.max(0, daysBetween(start, e) / total));
    pts.push({ x, y });
  }
  const nowX = Math.min(1, Math.max(0, daysBetween(start, todayKey()) / total));
  pts.push({ x: nowX, y });
  return pts;
}

function ProgressCircle({ pct, size = 16 }: { pct: number; size?: number }) {
  const r = (size - 3) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e2e2" strokeWidth={2} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={2}
        strokeDasharray={`${(pct / 100) * c} ${c}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
}

/* ------------ Goals list ------------ */

export function GoalsView({ setView }: { setView: (v: View) => void }) {
  const { data, updateGoal } = useStore();
  const [modal, setModal] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [sort, setSort] = useState("");
  const [fArea, setFArea] = useState("");
  const [fImpact, setFImpact] = useState("");
  const [fStart, setFStart] = useState("");
  const [fDeadline, setFDeadline] = useState("");

  let goals = data.goals.filter((g) => !g.parentId && (showArchived || !g.archived) && (showCompleted || !g.completedAt));
  if (fArea) goals = goals.filter((g) => g.areaId === fArea);
  if (fImpact) goals = goals.filter((g) => g.impact === fImpact);
  const inPeriod = (key: string | null | undefined, period: string): boolean => {
    if (!key) return false;
    const t = todayKey();
    if (period === "week") { const ws = weekStart(t); return key >= ws && key <= addDays(ws, 6); }
    if (period === "month") return key.slice(0, 7) === t.slice(0, 7);
    if (period === "quarter") {
      const d = fromKey(t); const q = Math.floor(d.getMonth() / 3);
      const from = toKey(new Date(d.getFullYear(), q * 3, 1));
      const to = toKey(new Date(d.getFullYear(), q * 3 + 3, 0));
      return key >= from && key <= to;
    }
    return true;
  };
  if (fStart) goals = goals.filter((g) => inPeriod(g.startDate, fStart));
  if (fDeadline) goals = goals.filter((g) => inPeriod(g.deadline, fDeadline));
  if (sort === "name") goals = [...goals].sort((a, b) => a.name.localeCompare(b.name, "ru"));
  if (sort === "deadline") goals = [...goals].sort((a, b) => ((a.deadline ?? "9999") < (b.deadline ?? "9999") ? -1 : 1));
  if (sort === "progress") goals = [...goals].sort((a, b) => goalProgress(b, data) - goalProgress(a, data));

  return (
    <>
      <div className="page-head">
        <div className="page-title">Мои цели</div>
        <div className="spacer" />
        <div className="seg">
          <button className={viewMode === "table" ? "active" : ""} onClick={() => setViewMode("table")}><ColumnsIcon /></button>
          <button className={viewMode === "cards" ? "active" : ""} onClick={() => setViewMode("cards")}><CardIcon /></button>
        </div>
        <button className="icon-btn" onClick={() => setFilterOpen(true)}><FilterLines size={18} /></button>
        <button className="icon-btn" onClick={() => setSettingsOpen(true)}><Settings2 size={18} /></button>
        <button className="btn-primary" onClick={() => setModal(true)}><Plus size={15} /> Добавить цель</button>
      </div>

      {filterOpen && (
        <Pop onClose={() => setFilterOpen(false)} className="filter-pop" style={{ top: 58, right: 150 }}>
          <div className="pop-head">Фильтр целей</div>
          <div className="pop-body">
            <div className="pop-sub">Сортировка и группировка</div>
            <div className="pop-row">
              <div className="flabel"><span className="fic"><SortIcon /></span>Сортировка</div>
              <PSel value={sort} placeholder="Выбрать" onChange={setSort}
                options={[
                  { v: "deadline", l: "По дедлайну" },
                  { v: "progress", l: "По прогрессу" },
                  { v: "name", l: "По названию" },
                ]} />
            </div>
            <div className="pop-row">
              <div className="flabel"><span className="fic"><FilterLines size={16} /></span>Группировка</div>
              <PSel value="" placeholder="Нет" onChange={() => {}} options={[{ v: "none", l: "Нет" }]} />
            </div>
            <div className="pop-sep" />
            <div className="pop-sub">Фильтры</div>
            <div className="pop-row">
              <div className="flabel"><span className="fic"><Heart size={16} /></span>Сферы жизни</div>
              <PSel value={fArea} placeholder="Выбрать" onChange={setFArea}
                options={data.areas.map((a) => ({ v: a.id, l: a.name }))} />
            </div>
            <div className="pop-row">
              <div className="flabel">
                <span className="fic"><ListIcon size={16} /></span>Активные цели
                <InfoCircle size={13} className="muted" />
              </div>
              <PSel value={showCompleted ? "all" : ""} placeholder="Только активные"
                onChange={(v) => setShowCompleted(v === "all")}
                options={[{ v: "all", l: "Вместе с завершёнными" }]} />
            </div>
            <div className="pop-row">
              <div className="flabel"><span className="fic"><Bolt size={16} /></span>Влияние цели</div>
              <PSel value={fImpact} placeholder="Выбрать" onChange={setFImpact}
                options={[
                  { v: "High", l: "Высокое" },
                  { v: "Medium", l: "Среднее" },
                  { v: "Low", l: "Низкое" },
                ]} />
            </div>
            <div className="pop-row">
              <div className="flabel"><span className="fic"><CalendarDay size={16} /></span>Начало</div>
              <PSel value={fStart} placeholder="Выбрать" onChange={setFStart}
                options={[{ v: "week", l: "Эта неделя" }, { v: "month", l: "Этот месяц" }]} />
            </div>
            <div className="pop-row">
              <div className="flabel"><span className="fic"><Flag size={16} /></span>Дедлайн</div>
              <PSel value={fDeadline} placeholder="Выбрать" onChange={setFDeadline}
                options={[{ v: "week", l: "Эта неделя" }, { v: "month", l: "Этот месяц" }, { v: "quarter", l: "Этот квартал" }]} />
            </div>
          </div>
          {(sort || fArea || fImpact || fStart || fDeadline || showCompleted) && (
            <button className="pop-reset" onClick={() => { setSort(""); setFArea(""); setFImpact(""); setFStart(""); setFDeadline(""); setShowCompleted(false); }}>
              Сбросить фильтры
            </button>
          )}
        </Pop>
      )}

      {settingsOpen && (
        <Pop onClose={() => setSettingsOpen(false)} style={{ top: 58, right: 100, width: 340 }}>
          <div className="pop-row" style={{ padding: "2px 0" }}>
            <div className="flabel" style={{ fontSize: 15 }}>Показывать завершённые цели</div>
            <Toggle on={showCompleted} onChange={setShowCompleted} />
          </div>
          <div className="pop-row" style={{ padding: "2px 0" }}>
            <div className="flabel" style={{ fontSize: 15 }}>Показывать архивные</div>
            <Toggle on={showArchived} onChange={setShowArchived} />
          </div>
        </Pop>
      )}

      <div className="main-scroll">
        {goals.length === 0 ? (
          <div className="empty-state" style={{ paddingTop: 140 }}>
            <div className="es-icon"><Target size={44} strokeWidth={1.2} /></div>
            <h3>Создайте цель</h3>
            <p>Ставьте цели, которые приближают вас к идеальной жизни.</p>
            <button className="btn-primary" onClick={() => setModal(true)}>Создать цель</button>
          </div>
        ) : viewMode === "cards" ? (
          <div className="goal-cards">
            {goals.map((g) => {
              const pct = goalProgress(g, data);
              const area = data.areas.find((a) => a.id === g.areaId);
              return (
                <div key={g.id} className="goal-card" onClick={() => setView({ kind: "goal", id: g.id })}>
                  <span className="row-dot-icon">
                    {g.icon ? <AreaIcon icon={g.icon} size={22} /> : <Target size={22} />}
                    <span className="cdot" style={{ background: goalColor(g, data.areas) }} />
                  </span>
                  <div className="gc-name">{g.name}</div>
                  <div className="gc-meta">
                    <ProgressCircle pct={pct} /> {pct}%
                    {g.impact && <span className={`badge ${g.impact.toLowerCase()}`}><Bolt size={11} /> {IMPACT_RU[g.impact]}</span>}
                  </div>
                  <div className="gc-area">{area?.name ?? ""}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="table" style={{ ["--cols" as string]: "minmax(220px, 1fr) 96px 118px 88px 106px 72px 150px" } as React.CSSProperties}>
            <div className="table-head">
              <div>Название</div>
              <div>Прогресс</div>
              <div>Влияние</div>
              <div>Начало</div>
              <div>Дедлайн</div>
              <div>Задачи</div>
              <div>Сфера жизни</div>
            </div>
            {goals.map((g) => {
              const pct = goalProgress(g, data);
              const area = data.areas.find((a) => a.id === g.areaId);
              const taskCount = data.tasks.filter((t) => t.goalId === g.id && !t.deletedAt).length;
              return (
                <div key={g.id} className="table-row" onClick={() => setView({ kind: "goal", id: g.id })}>
                  <div className="row-name" style={g.completedAt ? { textDecoration: "line-through", color: "#a8a8a8" } : undefined}>
                    <span className="row-dot-icon">
                      {g.icon ? <AreaIcon icon={g.icon} size={22} /> : <Target size={22} />}
                      <span className="cdot" style={{ background: goalColor(g, data.areas) }} />
                    </span>
                    {g.name}
                  </div>
                  <div className="cell" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <ProgressCircle pct={pct} /> {pct}%
                  </div>
                  <div className="cell" onClick={(e) => e.stopPropagation()}>
                    <Dropdown trigger={
                      g.impact
                        ? <span className={`badge ${g.impact.toLowerCase()}`}><Bolt size={11} /> {IMPACT_RU[g.impact]}</span>
                        : <span className="muted">–</span>
                    }>
                      {(close) => (
                        <>
                          {(["High", "Medium", "Low"] as Impact[]).map((im) => (
                            <MenuItem key={im} selected={g.impact === im}
                              onClick={() => { updateGoal(g.id, { impact: im }); close(); }}>
                              {IMPACT_RU[im]}
                            </MenuItem>
                          ))}
                          <MenuItem selected={!g.impact} onClick={() => { updateGoal(g.id, { impact: null }); close(); }}>Нет</MenuItem>
                        </>
                      )}
                    </Dropdown>
                  </div>
                  <div className="cell" onClick={(e) => e.stopPropagation()}>
                    <Dropdown trigger={<span className="cell-btn">{g.startDate ? fmtDayMon(g.startDate) : "–"}</span>}>
                      {(close) => <DateMenu value={g.startDate ?? null} close={close}
                        onChange={(v) => updateGoal(g.id, { startDate: v })} />}
                    </Dropdown>
                  </div>
                  <div className="cell" onClick={(e) => e.stopPropagation()}>
                    <Dropdown trigger={
                      <span className="cell-btn">
                        {g.deadline ? <><Flag size={13} /> {timeLeft(g.deadline)}</> : "–"}
                      </span>
                    }>
                      {(close) => <DateMenu value={g.deadline ?? null} close={close} noneLabel="Без дедлайна"
                        onChange={(v) => updateGoal(g.id, { deadline: v })} />}
                    </Dropdown>
                  </div>
                  <div className="cell" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <Check size={14} /> {taskCount}
                  </div>
                  <div className="cell" onClick={(e) => e.stopPropagation()}>
                    <Dropdown align="right" trigger={<span className="cell-btn wrap">{area?.name ?? "–"}</span>}>
                      {(close) => (
                        <>
                          {data.areas.map((a) => (
                            <MenuItem key={a.id} selected={g.areaId === a.id}
                              onClick={() => { updateGoal(g.id, { areaId: a.id }); close(); }}>
                              <span className="cbar" style={{ background: a.color }} />{a.name}
                            </MenuItem>
                          ))}
                          <MenuItem selected={!g.areaId} onClick={() => { updateGoal(g.id, { areaId: null }); close(); }}>Нет</MenuItem>
                        </>
                      )}
                    </Dropdown>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {modal && <GoalModal onClose={() => setModal(false)} />}
    </>
  );
}

function SortIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4v16M7 4 4 7M7 4l3 3" /><path d="M17 20V4M17 20l-3-3M17 20l3-3" />
    </svg>
  );
}

function ColumnsIcon() {
  return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M12 4v16" /></svg>;
}
function CardIcon() {
  return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18" /></svg>;
}

/* ------------ Goal modal ------------ */

export function GoalModal({ goal, onClose, defaultAreaId, parentId }: {
  goal?: Goal; onClose: () => void; defaultAreaId?: string; parentId?: string;
}) {
  const { data, addGoal, updateGoal } = useStore();
  const t = todayKey();
  const [f, setF] = useState(() => ({
    name: goal?.name ?? "",
    description: goal?.description ?? "",
    areaId: goal?.areaId ?? defaultAreaId ?? "",
    impact: goal?.impact ?? "",
    startDate: goal?.startDate ?? t,
    deadline: goal?.deadline ?? "",
    metric: goal?.metric ?? ("none" as Metric),
    startValue: goal?.startValue ?? 0,
    targetValue: goal?.targetValue ?? 0,
    label: goal?.label ?? "",
    color: goal?.color ?? null as string | null,
    favorite: goal?.favorite ?? false,
    icon: goal?.icon ?? "",
  }));
  const [colorOpen, setColorOpen] = useState(false);

  const save = () => {
    if (!f.name.trim()) return;
    const patch = {
      name: f.name.trim(),
      description: f.description || undefined,
      areaId: f.areaId || null,
      impact: (f.impact || null) as Impact | null,
      startDate: f.startDate || null,
      deadline: f.deadline || null,
      metric: f.metric,
      startValue: f.startValue,
      targetValue: f.targetValue,
      label: f.label || undefined,
      color: f.color,
      favorite: f.favorite,
      icon: f.icon || undefined,
      parentId: goal?.parentId ?? parentId ?? null,
    };
    if (goal) updateGoal(goal.id, patch);
    else addGoal({ ...patch, currentValue: f.startValue });
    onClose();
  };

  const colorName = f.color ? (PALETTE.find((p) => p.hex === f.color)?.name ?? f.color) : "Как у сферы жизни";
  const areaColor = data.areas.find((a) => a.id === f.areaId)?.color ?? "#46a758";

  return (
    <Modal onClose={onClose}>
      <div className="modal-scroll">
        <div className="modal-head">
          <Dropdown trigger={
            <span className="m-icon" title="Выбрать иконку">
              {f.icon ? <AreaIcon icon={f.icon} size={24} /> : <Target size={24} />}
            </span>
          }>
            {(close) => (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: 8, width: 200 }}>
                <button className="icon-btn" onClick={() => { setF({ ...f, icon: "" }); close(); }}><Target size={18} /></button>
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
            <input className="m-name" autoFocus placeholder="Название цели" value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })} />
            <input className="m-desc" placeholder="Описание" value={f.description}
              onChange={(e) => setF({ ...f, description: e.target.value })} />
          </div>
        </div>

        <div className="frow">
          <div className="flabel"><span className="fic"><Heart size={17} /></span>Сфера жизни</div>
          <div className="fctrl">
            <Select value={f.areaId} placeholder="Выбрать" onChange={(v) => setF({ ...f, areaId: v })}>
              {data.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </div>
        </div>
        <div className="frow">
          <div className="flabel"><span className="fic"><Bolt size={17} /></span>Влияние</div>
          <div className="fctrl">
            <Select value={f.impact} placeholder="Выбрать" onChange={(v) => setF({ ...f, impact: v })}>
              <option value="High">Высокий</option><option value="Medium">Средний</option><option value="Low">Низкий</option>
            </Select>
          </div>
        </div>
        <div className="frow">
          <div className="flabel"><span className="fic"><CalendarDay size={17} /></span>Дата начала</div>
          <div className="fctrl">
            <input type="date" className="finput" value={f.startDate}
              onChange={(e) => setF({ ...f, startDate: e.target.value })} />
          </div>
        </div>
        <div className="frow">
          <div className="flabel"><span className="fic"><Flag size={17} /></span>Дедлайн</div>
          <div className="fctrl">
            <input type="date" className="finput" value={f.deadline}
              onChange={(e) => setF({ ...f, deadline: e.target.value })} />
          </div>
        </div>

        <div className="fsep" />

        <div className="frow">
          <div className="flabel"><span className="fic"><ChartBars size={17} /></span>Метрика успеха</div>
          <div className="fctrl">
            <Select value={f.metric} onChange={(v) => setF({ ...f, metric: v as Metric })}>
              <option value="none">Нет</option>
              <option value="numeric">Числовая цель</option>
              <option value="tasks">Выполнение задач</option>
            </Select>
          </div>
        </div>
        {f.metric === "numeric" && (
          <>
            <div className="frow">
              <div className="flabel"><span className="fic"><ArrowUpIcon /></span>Начальное значение</div>
              <div className="fctrl"><input type="number" className="num-input" value={f.startValue}
                onChange={(e) => setF({ ...f, startValue: Number(e.target.value) })} /></div>
            </div>
            <div className="frow">
              <div className="flabel"><span className="fic"><Target size={17} /></span>Целевое значение</div>
              <div className="fctrl"><input type="number" className="num-input" value={f.targetValue}
                onChange={(e) => setF({ ...f, targetValue: Number(e.target.value) })} /></div>
            </div>
            <div className="frow">
              <div className="flabel"><span className="fic"><LabelIcon /></span>Единица</div>
              <div className="fctrl"><input className="finput" placeholder="напр. кг, $, страницы" value={f.label}
                onChange={(e) => setF({ ...f, label: e.target.value })} /></div>
            </div>
          </>
        )}

        <div className="fsep" />

        <div className="frow" style={{ position: "relative" }}>
          <div className="flabel"><span className="fic"><PaletteIcon /></span>Цвет</div>
          <div className="fctrl">
            <button type="button" className="select" style={{ display: "flex", alignItems: "center", gap: 8, textAlign: "left" }}
              onClick={() => setColorOpen(!colorOpen)}>
              <span className="swatch" style={{ width: 10, height: 10, borderRadius: "50%", background: f.color ?? areaColor }} />
              {colorName}
            </button>
          </div>
          {colorOpen && (
            <div className="color-pop">
              <button className="color-opt" onClick={() => { setF({ ...f, color: null }); setColorOpen(false); }}>
                <span className="swatch" style={{ background: areaColor }} /> Как у сферы жизни
              </button>
              {PALETTE.map((c) => (
                <button key={c.name} className="color-opt" onClick={() => { setF({ ...f, color: c.hex }); setColorOpen(false); }}>
                  <span className="swatch" style={{ background: c.hex }} /> {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="frow">
          <div className="flabel"><span className="fic"><Star size={17} /></span>Избранное</div>
          <div className="fctrl"><Toggle on={f.favorite} onChange={(v) => setF({ ...f, favorite: v })} /></div>
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn-ghost" onClick={onClose}>Отмена</button>
        <button className="btn-primary" onClick={save}>Сохранить</button>
      </div>
    </Modal>
  );
}

function ArrowUpIcon() {
  return <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>;
}
function LabelIcon() {
  return <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round"><path d="M4 7h16M4 12h10M4 17h7" /></svg>;
}
function PaletteIcon() {
  return <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 1.5-2s0-2 1.5-2h2a4 4 0 0 0 4-5" /><circle cx="8" cy="10" r="1" fill="currentColor" /><circle cx="12" cy="7.5" r="1" fill="currentColor" /><circle cx="16" cy="10" r="1" fill="currentColor" /></svg>;
}

/* ------------ Goal detail ------------ */

export function GoalDetail({ id, tab, setView }: { id: string; tab?: string; setView: (v: View) => void }) {
  const { data, updateGoal, deleteGoal, addGoal } = useStore();
  const goal = data.goals.find((g) => g.id === id);
  const [activeTab, setActiveTab] = useState(tab ?? "Обзор");
  const [edit, setEdit] = useState(false);
  const [subModal, setSubModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [menuPage, setMenuPage] = useState<"main" | "move">("main");
  if (!goal) return <div className="empty-state">Цель не найдена</div>;

  const area = data.areas.find((a) => a.id === goal.areaId);
  const pct = goalProgress(goal, data);
  const tasks = data.tasks.filter((t) => t.goalId === goal.id && !t.deletedAt && !t.completedAt);
  const subgoals = data.goals.filter((g) => g.parentId === goal.id);

  return (
    <>
      <div className="page-head" style={{ borderBottom: "1px solid var(--border)" }}>
        <button className="icon-btn" onClick={() => setView({ kind: "goals" })}><ArrowLeft size={17} /></button>
        <span className="row-dot-icon" style={{ width: 20, height: 20 }}>
          {goal.icon ? <AreaIcon icon={goal.icon} size={18} /> : <Target size={18} />}
          <span className="cdot" style={{ background: goalColor(goal, data.areas) }} />
        </span>
        <div className="page-title" style={{ fontSize: 17 }}>{goal.name}</div>
        <div className="spacer" />
        <div className="head-tabs">
          {["Обзор", "Прогресс", "Роадмап", "Задачи"].map((t) => (
            <button key={t} className={`head-tab${activeTab === t ? " active" : ""}`} onClick={() => setActiveTab(t)}>{t}</button>
          ))}
        </div>
        <div className="spacer" />
        <button className="icon-btn" onClick={() => updateGoal(goal.id, { favorite: !goal.favorite })}>
          <Star size={18} filled={goal.favorite} />
        </button>
        <Dropdown align="right" width={250} trigger={<span className="icon-btn"><Dots size={17} /></span>}>
          {(close) => {
            const done = (fn?: () => void) => { fn?.(); setMenuPage("main"); close(); };
            if (menuPage === "move") {
              return (
                <>
                  <div className="menu-label">Переместить в сферу</div>
                  {data.areas.map((a) => (
                    <MenuItem key={a.id} selected={goal.areaId === a.id}
                      onClick={() => done(() => updateGoal(goal.id, { areaId: a.id }))}>
                      <span className="cbar" style={{ background: a.color }} />{a.name}
                    </MenuItem>
                  ))}
                  <MenuItem onClick={() => setMenuPage("main")}>← Назад</MenuItem>
                </>
              );
            }
            return (
              <>
                <MenuItem onClick={() => done(() => setEdit(true))}><Pencil size={15} /> Редактировать цель</MenuItem>
                <MenuItem onClick={() => done(() => updateGoal(goal.id, { startDate: null, deadline: null }))}>
                  <CalendarDay size={15} /> Очистить даты
                </MenuItem>
                <MenuItem onClick={() => done(() => updateGoal(goal.id, { favorite: !goal.favorite }))}>
                  <Star size={15} /> {goal.favorite ? "Убрать из избранного" : "В избранное"}
                </MenuItem>
                <div className="menu-sep" />
                <MenuItem onClick={() => done(() => updateGoal(goal.id, { completedAt: goal.completedAt ? null : new Date().toISOString() }))}>
                  <Check size={15} /> {goal.completedAt ? "Возобновить цель" : "Завершить цель"}
                </MenuItem>
                <div className="menu-sep" />
                <MenuItem onClick={() => setMenuPage("move")}>→ Переместить в…</MenuItem>
                <MenuItem onClick={() => done(() => setSubModal(true))}><Plus size={15} /> Добавить подцель</MenuItem>
                <div className="menu-sep" />
                <div className="menu-item" style={{ cursor: "default" }}>
                  <span style={{ flex: 1 }}>Показывать роадмап</span>
                  <Toggle on={goal.showRoadmap !== false} onChange={(v) => updateGoal(goal.id, { showRoadmap: v })} />
                </div>
                <div className="menu-sep" />
                <MenuItem onClick={() => done(() => {
                  const { id, createdAt, order, favorite, ...rest } = goal;
                  addGoal({ ...rest, name: `${goal.name} (копия)`, favorite: false });
                })}><Target size={15} /> Дублировать</MenuItem>
                <MenuItem onClick={() => done(() => {
                  updateGoal(goal.id, { archived: !goal.archived });
                  if (!goal.archived) setView({ kind: "goals" });
                })}>
                  <MapPin size={15} /> {goal.archived ? "Вернуть из архива" : "Архивировать"}
                </MenuItem>
                <button type="button" className="menu-item" style={{ color: "var(--red)" }}
                  onClick={() => {
                    if (window.confirm(`Удалить цель «${goal.name}» безвозвратно?`)) {
                      done(() => { deleteGoal(goal.id); setView({ kind: "goals" }); });
                    }
                  }}>
                  <span className="mi-check" style={{ color: "var(--red)" }}><Trash size={15} /></span>Удалить
                </button>
              </>
            );
          }}
        </Dropdown>
      </div>

      <div className="main-scroll">
        {(activeTab === "Обзор") && (
          <>
            <div className="goal-hero">
              <div className="gh-icon">
                {goal.icon ? <AreaIcon icon={goal.icon} size={38} /> : <Target size={38} />}
                <span className="cdot" style={{ background: goalColor(goal, data.areas) }} />
              </div>
              <div>
                {area && <div className="gh-area"><AreaIcon icon={area.icon} size={14} /> {area.name}</div>}
                <div className="gh-name">{goal.name}</div>
                {goal.description && <div className="gh-desc">{goal.description}</div>}
                <div className="gh-meta">
                  {goal.startDate && goal.deadline && (
                    <span className="mi"><CalendarDay size={14} /> {fmtDayMon(goal.startDate)} – {fmtDayMon(goal.deadline)}</span>
                  )}
                  {goal.impact && <span className="mi"><Bolt size={14} /> {IMPACT_RU[goal.impact]}</span>}
                  {goal.deadline && <span className="mi"><Flag size={14} /> {timeLeftLong(goal.deadline)}</span>}
                  <span className="mi"><ProgressCircle pct={pct} size={15} /> {pct}%</span>
                </div>
              </div>
            </div>
            {goal.showRoadmap !== false && (
              <RoadmapSection goal={goal} subgoals={subgoals} onAdd={() => setSubModal(true)} setView={setView} />
            )}
            <TasksSection goalId={goal.id} tasks={tasks} onOpen={setEditingTask} />
          </>
        )}

        {activeTab === "Прогресс" && <ProgressTab goal={goal} />}

        {activeTab === "Роадмап" && (
          <RoadmapSection goal={goal} subgoals={subgoals} onAdd={() => setSubModal(true)} setView={setView} standalone />
        )}

        {activeTab === "Задачи" && <TasksSection goalId={goal.id} tasks={tasks} onOpen={setEditingTask} standalone />}
      </div>

      {edit && <GoalModal goal={goal} onClose={() => setEdit(false)} />}
      {subModal && <GoalModal parentId={goal.id} defaultAreaId={goal.areaId ?? undefined} onClose={() => setSubModal(false)} />}
      {editingTask && <TaskModal task={editingTask} onClose={() => setEditingTask(null)} />}
    </>
  );
}

function RoadmapSection({ goal, subgoals, onAdd, setView, standalone }: {
  goal: Goal; subgoals: Goal[]; onAdd: () => void; setView: (v: View) => void; standalone?: boolean;
}) {
  const { data } = useStore();
  const [open, setOpen] = useState(true);
  const [sort, setSort] = useState("manual");
  let list = subgoals;
  if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name, "ru"));
  if (sort === "progress") list = [...list].sort((a, b) => goalProgress(b, data) - goalProgress(a, data));
  return (
    <div className="section-card" style={standalone ? { borderTop: "none" } : undefined}>
      <div className="section-head">
        <span className="section-title" style={{ cursor: "pointer" }} onClick={() => setOpen(!open)}>Роадмап</span>
        <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => setOpen(!open)}>
          {open ? <ChevronDown size={15} className="chev" /> : <ChevronRight size={15} className="chev" />}
        </button>
        <span className="spacer" />
        <Dropdown align="right" trigger={<span className="icon-btn"><FilterLines size={17} /></span>}>
          {(close) => (
            <>
              <div className="menu-label">Сортировка</div>
              <MenuItem selected={sort === "manual"} onClick={() => { setSort("manual"); close(); }}>Вручную</MenuItem>
              <MenuItem selected={sort === "name"} onClick={() => { setSort("name"); close(); }}>По названию</MenuItem>
              <MenuItem selected={sort === "progress"} onClick={() => { setSort("progress"); close(); }}>По прогрессу</MenuItem>
            </>
          )}
        </Dropdown>
        <button className="icon-btn" onClick={onAdd}><Plus size={17} /></button>
        <Dropdown align="right" trigger={<span className="icon-btn"><Settings2 size={17} /></span>}>
          {(close) => (
            <MenuItem onClick={() => { setOpen(!open); close(); }}>{open ? "Свернуть секцию" : "Развернуть секцию"}</MenuItem>
          )}
        </Dropdown>
      </div>
      {open && <RoadmapTimeline subgoals={subgoals} />}
      {!open ? null : subgoals.length === 0 ? (
        <div className="empty-state">
          <div className="es-icon"><MapPin size={34} strokeWidth={1.3} /></div>
          <h3>Определите подцели</h3>
          <p>Разбейте большие цели на подцели и постройте роадмап.</p>
          <button className="btn-primary" onClick={onAdd}>Создать подцель</button>
          <div className="empty-note">У этой цели нет подцелей</div>
        </div>
      ) : (
        <div className="task-list">
          {list.map((s) => {
            const pct = goalProgress(s, data);
            return (
              <div key={s.id} className="task-row" onClick={() => setView({ kind: "goal", id: s.id })}>
                <span className="row-dot-icon" style={{ width: 20, height: 20 }}>
                  <Target size={18} />
                  <span className="cdot" style={{ background: goalColor(s, data.areas) }} />
                </span>
                <div className="task-body">
                  <div className="task-title">{s.name}</div>
                </div>
                <span className="cell" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <ProgressCircle pct={pct} /> {pct}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Таймлайн подцелей: полосы по датам (когда есть хотя бы одна подцель с датами) */
function RoadmapTimeline({ subgoals }: { subgoals: Goal[] }) {
  const { data } = useStore();
  const dated = subgoals.filter((s) => s.startDate && s.deadline);
  if (dated.length === 0) return null;
  const min = dated.reduce((m, s) => (s.startDate! < m ? s.startDate! : m), dated[0].startDate!);
  const max = dated.reduce((m, s) => (s.deadline! > m ? s.deadline! : m), dated[0].deadline!);
  const total = Math.max(1, daysBetween(min, max));
  const t = todayKey();
  const nowX = Math.min(100, Math.max(0, (daysBetween(min, t) / total) * 100));
  return (
    <div style={{ padding: "4px 24px 12px 24px" }}>
      <div style={{ position: "relative", borderLeft: "1px solid var(--border-soft)", borderRight: "1px solid var(--border-soft)" }}>
        {t >= min && t <= max && (
          <div style={{ position: "absolute", top: 0, bottom: 0, left: `${nowX}%`, width: 1.5, background: "#ef4444", zIndex: 2 }} />
        )}
        {dated.map((s) => {
          const left = (daysBetween(min, s.startDate!) / total) * 100;
          const width = Math.max(3, (daysBetween(s.startDate!, s.deadline!) / total) * 100);
          const pct = goalProgress(s, data);
          return (
            <div key={s.id} style={{ position: "relative", height: 30, marginBottom: 4 }}>
              <div style={{
                position: "absolute", left: `${left}%`, width: `${width}%`, top: 3, bottom: 3,
                background: "var(--accent-soft)", borderRadius: 8, overflow: "hidden",
              }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, background: "var(--accent-softer)" }} />
                <span style={{
                  position: "relative", zIndex: 1, fontSize: 12, fontWeight: 600, color: "var(--accent)",
                  padding: "0 8px", lineHeight: "24px", whiteSpace: "nowrap",
                }}>{s.name} · {pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9a9a9a", marginTop: 4 }}>
        <span>{fmtDayMon(min)}</span>
        <span>{fmtDayMon(max)}</span>
      </div>
    </div>
  );
}

function TasksSection({ goalId, tasks, onOpen, standalone }: {
  goalId: string; tasks: Task[]; onOpen: (t: Task) => void; standalone?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("manual");
  const boxRef = useRef<HTMLDivElement>(null);

  let list = tasks.filter((t) => !query || t.title.toLowerCase().includes(query.toLowerCase()));
  if (sort === "name") list = [...list].sort((a, b) => a.title.localeCompare(b.title, "ru"));
  if (sort === "date") list = [...list].sort((a, b) => ((a.date ?? "9999") < (b.date ?? "9999") ? -1 : 1));

  return (
    <div className="section-card" style={standalone ? { borderTop: "none" } : undefined} ref={boxRef}>
      <div className="section-head">
        <span className="section-title" style={{ cursor: "pointer" }} onClick={() => setOpen(!open)}>Задачи</span>
        <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => setOpen(!open)}>
          {open ? <ChevronDown size={15} className="chev" /> : <ChevronRight size={15} className="chev" />}
        </button>
        <span className="spacer" />
        <button className="icon-btn" onClick={() => { setSearchOpen(!searchOpen); if (searchOpen) setQuery(""); }}>
          <Search size={17} />
        </button>
        <button className="icon-btn" onClick={() => {
          setOpen(true);
          setTimeout(() => boxRef.current?.querySelector<HTMLInputElement>(".add-task input, .composer input.c-title")?.focus(), 0);
        }}><Plus size={17} /></button>
        <Dropdown align="right" trigger={<span className="icon-btn"><FilterLines size={17} /></span>}>
          {(close) => (
            <>
              <div className="menu-label">Сортировка</div>
              <MenuItem selected={sort === "manual"} onClick={() => { setSort("manual"); close(); }}>Вручную</MenuItem>
              <MenuItem selected={sort === "date"} onClick={() => { setSort("date"); close(); }}>По дате</MenuItem>
              <MenuItem selected={sort === "name"} onClick={() => { setSort("name"); close(); }}>По названию</MenuItem>
            </>
          )}
        </Dropdown>
        <Dropdown align="right" trigger={<span className="icon-btn"><Settings2 size={17} /></span>}>
          {(close) => (
            <MenuItem onClick={() => { setOpen(!open); close(); }}>{open ? "Свернуть секцию" : "Развернуть секцию"}</MenuItem>
          )}
        </Dropdown>
      </div>
      {open && (
        <>
          {searchOpen && (
            <div style={{ padding: "0 24px 6px 24px" }}>
              <input className="finput" autoFocus placeholder="Поиск задач…" value={query}
                onChange={(e) => setQuery(e.target.value)} />
            </div>
          )}
          <div className="task-list">
            {list.map((t) => <TaskRow key={t.id} task={t} onClick={() => onOpen(t)} />)}
            <AddTask defaults={{ goalId }} />
          </div>
        </>
      )}
    </div>
  );
}

/* ------------ Progress tab (target chart) ------------ */

const RANGE_PRESETS: { v: string; l: string }[] = [
  { v: "term", l: "Весь срок цели" },
  { v: "30", l: "Последние 30 дней" },
  { v: "week", l: "Эта неделя" },
  { v: "month", l: "Этот месяц" },
  { v: "quarter", l: "Этот квартал" },
];

function rangeFor(goal: Goal, preset: string): [string, string] {
  const t = todayKey();
  if (preset === "30") return [addDays(t, -29), t];
  if (preset === "week") { const ws = weekStart(t); return [ws, addDays(ws, 6)]; }
  if (preset === "month") {
    const d = fromKey(t);
    return [toKey(new Date(d.getFullYear(), d.getMonth(), 1)), toKey(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
  }
  if (preset === "quarter") {
    const d = fromKey(t); const q = Math.floor(d.getMonth() / 3);
    return [toKey(new Date(d.getFullYear(), q * 3, 1)), toKey(new Date(d.getFullYear(), q * 3 + 3, 0))];
  }
  const start = goal.startDate ?? t;
  return [start, goal.deadline ?? addDays(start, 30)];
}

export function fmtGoalValue(v: number, label?: string): string {
  const num = Math.abs(v) >= 1000 ? `${Math.round((v / 1000) * 10) / 10}k` : String(v);
  return label ? `${num} ${label}` : num;
}

function UpdateProgressButton({ goal }: { goal: Goal }) {
  const { updateGoal } = useStore();
  const [val, setVal] = useState(String(goal.currentValue));
  const save = (close: () => void) => {
    const v = Number(val);
    if (Number.isFinite(v)) {
      updateGoal(goal.id, {
        currentValue: v,
        progressLog: [...(goal.progressLog ?? []), { date: todayKey(), value: v }],
      });
    }
    close();
  };
  return (
    <Dropdown trigger={
      <span className="btn-secondary" style={{ background: "var(--accent-soft)", border: "none", color: "var(--accent)" }}>
        Обновить прогресс
      </span>
    } width={240}>
      {(close) => (
        <div style={{ padding: 10 }}>
          <div className="menu-label" style={{ padding: "0 0 6px 0" }}>
            Текущее значение{goal.label ? ` (${goal.label})` : ""}
          </div>
          <input type="number" className="finput" autoFocus value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save(close)} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
            <button className="btn-ghost" style={{ padding: "6px 10px", fontSize: 13.5 }} onClick={close}>Отмена</button>
            <button className="btn-primary" style={{ padding: "6px 12px", fontSize: 13.5 }} onClick={() => save(close)}>
              Сохранить
            </button>
          </div>
        </div>
      )}
    </Dropdown>
  );
}

function ProgressTab({ goal }: { goal: Goal }) {
  const { data } = useStore();
  const [preset, setPreset] = useState("term");
  const linked = data.tasks.filter((t) => t.goalId === goal.id && !t.deletedAt);
  const done = linked.filter((t) => t.completedAt).length;
  const pct = goalProgress(goal, data);
  const [start, end] = rangeFor(goal, preset);

  return (
    <>
      <div className="chart-head" style={{ paddingTop: 18 }}>
        <span className="section-title" style={{ fontSize: 18 }}>Прогресс</span>
        <span style={{ marginLeft: "auto" }}>
          <Dropdown align="right" trigger={
            <span className="chart-range" style={{ cursor: "pointer" }}>
              {fmtShort(start)} – {fmtShort(end)} <ChevronDown size={13} />
            </span>
          }>
            {(close) => (
              <>
                {RANGE_PRESETS.map((r) => (
                  <MenuItem key={r.v} selected={preset === r.v}
                    onClick={() => { setPreset(r.v); close(); }}>{r.l}</MenuItem>
                ))}
              </>
            )}
          </Dropdown>
        </span>
      </div>
      <div className="chart-card">
        <div className="ic-head" style={{ marginTop: 8 }}>
          <span className="ic-icon"><LineChart size={15} /></span>
          <span className="ic-name">Цель</span>
          <Dots size={14} className="muted" />
        </div>
        <div className="ic-stats" style={{ justifyContent: "flex-start", gap: 6 }}>
          {goal.metric === "numeric" ? (
            <span className="ic-big">
              {fmtGoalValue(goal.currentValue)} <span>/ {fmtGoalValue(goal.targetValue, goal.label)}</span>
            </span>
          ) : (
            <span className="ic-big">{done} <span>/ {linked.length} задач</span></span>
          )}
        </div>
        <div className="ic-sub">
          {goal.deadline ? `${Math.max(1, Math.round(daysBetween(todayKey(), goal.deadline) / 30))} мес · ` : ""}{pct}%
        </div>
        <TargetChart goal={goal} pct={pct} rangeStart={start} rangeEnd={end}
          history={goalHistory(goal, data, start, end)} />
        {goal.metric === "numeric" && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
            <UpdateProgressButton goal={goal} />
          </div>
        )}
      </div>
    </>
  );
}

export function TargetChart({ goal, pct, compact, axis, history, rangeStart, rangeEnd }: {
  goal: Goal; pct: number; compact?: boolean; axis?: string[];
  history?: { x: number; y: number }[];
  rangeStart?: string; rangeEnd?: string;
}) {
  const W = 640, H = compact ? 110 : 140, PAD = 8;
  const start = rangeStart ?? goal.startDate ?? todayKey();
  const end = rangeEnd ?? goal.deadline ?? addDays(start, 30);
  const total = Math.max(1, daysBetween(start, end));
  const elapsed = Math.min(total, Math.max(0, daysBetween(start, todayKey())));
  const x = PAD + (elapsed / total) * (W - PAD * 2);
  const y = H - PAD - (pct / 100) * (H - PAD * 2);
  const dl = goal.deadline && goal.deadline >= start && goal.deadline <= end
    ? PAD + (daysBetween(start, goal.deadline) / total) * (W - PAD * 2)
    : null;

  return (
    <div style={{ width: "100%" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: compact ? 90 : 120, display: "block" }}>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={PAD} x2={W - PAD} y1={H * f} y2={H * f} stroke="#eee" strokeDasharray="3 4" />
        ))}
        <line x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} stroke="#e2e2e2" />
        {/* target dashed diagonal */}
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={PAD} stroke="#d9d9d9" strokeDasharray="4 4" />
        {/* фактическая история прогресса */}
        {history && history.length > 1 ? (
          <polyline
            fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round"
            points={history.map((p) => `${PAD + p.x * (W - PAD * 2)},${H - PAD - (p.y / 100) * (H - PAD * 2)}`).join(" ")}
          />
        ) : (
          <line x1={PAD} y1={H - PAD} x2={x} y2={y} stroke="var(--accent)" strokeWidth={2} />
        )}
        {/* today marker */}
        <line x1={x} y1={PAD} x2={x} y2={H - PAD} stroke="var(--accent)" strokeDasharray="3 3" opacity={0.6} />
        <circle cx={x} cy={y} r={5} fill="#fff" stroke="var(--accent)" strokeWidth={2} />
        {dl !== null && <line x1={dl} y1={PAD} x2={dl} y2={H - PAD} stroke="#ef4444" strokeWidth={1.5} />}
      </svg>
      {axis && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9a9a9a", padding: "4px 2px 0 2px" }}>
          {axis.map((a, i) => <span key={i}>{a}</span>)}
        </div>
      )}
    </div>
  );
}
