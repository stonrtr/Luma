"use client";

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { Goal, Habit } from "@/lib/types";
import {
  todayKey, toKey, fromKey, weekStart, weekDays, addDays, DAY_LETTERS, MONTHS_SHORT,
  fmtShort, dayOfWeekMon0, daysBetween,
} from "@/lib/date";
import { ChevronLeft, ChevronRight, Dots, Target, Repeat, Settings2, LineChart } from "./icons";
import { Pop, Toggle } from "./ui";
import { goalProgress, goalColor, TargetChart, goalHistory, fmtGoalValue } from "./Goals";
import { habitActiveOn } from "./Habits";

type Period = "W" | "M" | "Q" | "Y";

const PERIOD_RU: Record<Period, string> = { W: "Н", M: "М", Q: "К", Y: "Г" };

function periodRange(p: Period, offset: number): [string, string] {
  const now = new Date();
  if (p === "W") {
    const s = addDays(weekStart(todayKey()), offset * 7);
    return [s, addDays(s, 6)];
  }
  if (p === "M") {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return [toKey(d), toKey(e)];
  }
  if (p === "Q") {
    const q = Math.floor(now.getMonth() / 3) + offset;
    const d = new Date(now.getFullYear(), q * 3, 1);
    const e = new Date(d.getFullYear(), d.getMonth() + 3, 0);
    return [toKey(d), toKey(e)];
  }
  const d = new Date(now.getFullYear() + offset, 0, 1);
  return [toKey(d), toKey(new Date(d.getFullYear(), 11, 31))];
}

function axisLabels(p: Period, start: string, end: string): string[] {
  if (p === "W") return DAY_LETTERS;
  if (p === "M") return [fmtShort(start), fmtShort(end)];
  if (p === "Q") {
    const s = fromKey(start);
    return [0, 1, 2].map((i) => MONTHS_SHORT[(s.getMonth() + i) % 12].slice(0, 1));
  }
  return MONTHS_SHORT.map((m) => m.slice(0, 1));
}

export function InsightsView() {
  const { data } = useStore();
  const [period, setPeriod] = useState<Period>("W");
  const [offset, setOffset] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showGoals, setShowGoals] = useState(true);
  const [showHabits, setShowHabits] = useState(true);
  const [start, end] = periodRange(period, offset);
  const goals = data.goals.filter((g) => !g.parentId && !g.completedAt && !g.archived);
  const habits = data.habits;

  return (
    <>
      <div className="page-head">
        <div className="page-title">Аналитика</div>
        <div className="spacer" />
        <div className="seg">
          {(["W", "M", "Q", "Y"] as Period[]).map((p) => (
            <button key={p} className={period === p ? "active" : ""}
              onClick={() => { setPeriod(p); setOffset(0); }}>{PERIOD_RU[p]}</button>
          ))}
        </div>
        <div className="pill-nav">
          <button onClick={() => setOffset(offset - 1)}><ChevronLeft size={15} /></button>
          <button onClick={() => setOffset(0)}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", border: "1.5px solid currentColor", display: "block" }} />
          </button>
          <button onClick={() => setOffset(offset + 1)}><ChevronRight size={15} /></button>
        </div>
        <div className="spacer" />
        <button className="icon-btn" onClick={() => setSettingsOpen(true)}><Settings2 size={18} /></button>
      </div>

      {settingsOpen && (
        <Pop onClose={() => setSettingsOpen(false)} style={{ top: 58, right: 16, width: 320 }}>
          <div className="pop-row" style={{ padding: "2px 0" }}>
            <div className="flabel" style={{ fontSize: 15 }}>Показывать цели</div>
            <Toggle on={showGoals} onChange={setShowGoals} />
          </div>
          <div className="pop-row" style={{ padding: "2px 0" }}>
            <div className="flabel" style={{ fontSize: 15 }}>Показывать привычки</div>
            <Toggle on={showHabits} onChange={setShowHabits} />
          </div>
        </Pop>
      )}

      <div className="main-scroll">
        {showGoals && <div className="insight-section" style={{ borderTop: "none" }}>
          <div className="section-head"><span className="section-title">Цели</span></div>
          {goals.length === 0 ? (
            <div className="empty-state"><p>Пока нет активных целей.</p></div>
          ) : (
            <div className="insight-grid">
              {goals.map((g) => <GoalInsight key={g.id} goal={g} period={period} start={start} end={end} />)}
            </div>
          )}
        </div>}

        {showHabits && <div className="insight-section">
          <div className="section-head"><span className="section-title">Привычки</span></div>
          {habits.length === 0 ? (
            <div className="empty-state"><p>Пока нет привычек.</p></div>
          ) : (
            <div className="insight-grid">
              {habits.map((h) => <HabitInsight key={h.id} habit={h} period={period} start={start} end={end} />)}
            </div>
          )}
        </div>}
      </div>
    </>
  );
}

/** События прогресса цели в интервале: выполненные задачи + полные дни привычек */
function goalEventsIn(goal: Goal, data: { tasks: any[]; habits: any[]; habitLogs: any[] }, from: string, to: string): number {
  let n = data.tasks.filter((t) =>
    t.goalId === goal.id && !t.deletedAt && t.completedAt &&
    t.completedAt.slice(0, 10) >= from && t.completedAt.slice(0, 10) <= to
  ).length;
  for (const h of data.habits.filter((h: any) => h.goalId === goal.id)) {
    n += data.habitLogs.filter((l: any) => l.habitId === h.id && l.count >= h.timesPerDay && l.date >= from && l.date <= to).length;
  }
  return n;
}

function TrendBadge({ cur, prev }: { cur: number; prev: number }) {
  if (cur === 0 && prev === 0) return null;
  const change = prev === 0 ? 100 : Math.round(((cur - prev) / prev) * 100);
  const up = change >= 0;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 2, fontSize: 13, fontWeight: 700,
      color: up ? "var(--green)" : "var(--red)",
    }}>
      {up ? "↑" : "↓"} {Math.abs(change)}%
    </span>
  );
}

function GoalInsight({ goal, period, start, end }: { goal: Goal; period: Period; start: string; end: string }) {
  const { data } = useStore();
  const linked = data.tasks.filter((t) => t.goalId === goal.id && !t.deletedAt);
  const done = linked.filter((t) => t.completedAt).length;
  const pct = goalProgress(goal, data);
  const months = goal.deadline ? Math.max(1, Math.round(daysBetween(todayKey(), goal.deadline) / 30)) : null;
  const len = daysBetween(start, end) + 1;
  let cur: number, prev: number;
  if (goal.metric === "numeric") {
    const log = goal.progressLog ?? [];
    const delta = (from: string, to: string) => {
      const inRange = log.filter((e) => e.date >= from && e.date <= to);
      if (inRange.length === 0) return 0;
      const before = log.filter((e) => e.date < from);
      const base = before.length ? before[before.length - 1].value : goal.startValue;
      return Math.max(0, inRange[inRange.length - 1].value - base);
    };
    cur = delta(start, end);
    prev = delta(addDays(start, -len), addDays(start, -1));
  } else {
    cur = goalEventsIn(goal, data, start, end);
    prev = goalEventsIn(goal, data, addDays(start, -len), addDays(start, -1));
  }

  return (
    <div className="insight-card">
      <div className="ic-head">
        <span className="ic-icon">
          <Target size={15} />
          <span className="cdot" style={{ background: goalColor(goal, data.areas) }} />
        </span>
        <span className="ic-name">{goal.name}</span>
        <Dots size={14} className="muted" />
      </div>
      <div className="ic-stats">
        <span className="ic-big" style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
          {goal.metric === "numeric"
            ? <>{fmtGoalValue(goal.currentValue)} <span>/ {fmtGoalValue(goal.targetValue, goal.label)}</span></>
            : <>{done} <span>/ {linked.length} задач</span></>}
        </span>
        <TrendBadge cur={cur} prev={prev} />
      </div>
      <div className="ic-sub">{months !== null ? `${months} мес · ` : ""}{pct}%</div>
      <TargetChart goal={goal} pct={pct} compact axis={axisLabels(period, start, end)} history={goalHistory(goal, data)} />
    </div>
  );
}

function HabitInsight({ habit, period, start, end }: { habit: Habit; period: Period; start: string; end: string }) {
  const { data } = useStore();
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);

  let done = 0, target = 0;
  const perDay: number[] = [];
  for (const d of days) {
    const active = habitActiveOn(habit, d);
    const count = data.habitLogs.find((l) => l.habitId === habit.id && l.date === d)?.count ?? 0;
    if (active) target += habit.timesPerDay;
    done += Math.min(habit.timesPerDay, count);
    perDay.push(count);
  }
  const pct = target > 0 ? Math.round((done / target) * 100) : 0;

  return (
    <div className="insight-card">
      <div className="ic-head">
        <span className="ic-icon"><Repeat size={15} /></span>
        <span className="ic-name">{habit.name}</span>
        <Dots size={14} className="muted" />
      </div>
      <div className="ic-stats">
        <span className="ic-big">{done} <span>/ {target}</span></span>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <TrendBadge cur={done} prev={(() => {
            const len = daysBetween(start, end) + 1;
            let p = 0;
            for (let d = addDays(start, -len); d <= addDays(start, -1); d = addDays(d, 1)) {
              const c = data.habitLogs.find((l) => l.habitId === habit.id && l.date === d)?.count ?? 0;
              p += Math.min(habit.timesPerDay, c);
            }
            return p;
          })()} />
          <span className="ic-pct"><CheckRing /> {pct}%</span>
        </span>
      </div>
      {period === "W" && <WeekBars perDay={perDay} max={habit.timesPerDay} />}
      {period === "M" && <MonthDots days={days} perDay={perDay} habit={habit} />}
      {(period === "Q" || period === "Y") && <BucketBars days={days} perDay={perDay} habit={habit} period={period} />}
    </div>
  );
}

function CheckRing() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  );
}

/** W: one vertical bar per day */
function WeekBars({ perDay, max }: { perDay: number[]; max: number }) {
  const H = 96;
  const yMax = Math.max(max, ...perDay, 1);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 0, height: H, position: "relative", borderBottom: "1px solid #eee" }}>
        <YLabels yMax={yMax} />
        {perDay.map((v, i) => (
          <div key={i} style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "flex-end", height: "100%" }}>
            <div style={{ width: 7, borderRadius: 4, height: "100%", background: "#f0f0f0", position: "relative" }}>
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0, borderRadius: 4,
                height: `${(v / yMax) * 100}%`, background: "var(--accent)",
              }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", marginTop: 4 }}>
        {DAY_LETTERS.map((l, i) => (
          <span key={i} style={{ flex: 1, textAlign: "center", fontSize: 12, color: "#9a9a9a" }}>{l}</span>
        ))}
      </div>
    </div>
  );
}

function YLabels({ yMax }: { yMax: number }) {
  return (
    <div style={{ position: "absolute", left: -2, top: 0, bottom: 0, width: 0, fontSize: 11, color: "#b0b0b0" }}>
      <span style={{ position: "absolute", top: -4, right: 6 }}>{yMax}</span>
      <span style={{ position: "absolute", top: "48%", right: 6 }}>{Math.round(yMax / 2)}</span>
      <span style={{ position: "absolute", bottom: -4, right: 6 }}>0</span>
    </div>
  );
}

/** M: grid of dots — columns are weekdays, rows are weeks */
function MonthDots({ days, perDay, habit }: { days: string[]; perDay: number[]; habit: Habit }) {
  const weeks: { d: string; v: number }[][] = [];
  let cur: { d: string; v: number }[] = [];
  days.forEach((d, i) => {
    if (dayOfWeekMon0(d) === 0 && cur.length) { weeks.push(cur); cur = []; }
    cur.push({ d, v: perDay[i] });
  });
  if (cur.length) weeks.push(cur);

  return (
    <div>
      <div style={{ display: "flex", marginBottom: 6 }}>
        {DAY_LETTERS.map((l, i) => (
          <span key={i} style={{ flex: 1, textAlign: "center", fontSize: 12, color: "#9a9a9a" }}>{l}</span>
        ))}
      </div>
      {weeks.map((w, wi) => (
        <div key={wi} style={{ display: "flex", marginBottom: 6 }}>
          {DAY_LETTERS.map((_, di) => {
            const cell = w.find((c) => dayOfWeekMon0(c.d) === di);
            if (!cell) return <span key={di} style={{ flex: 1 }} />;
            const full = cell.v >= habit.timesPerDay;
            return (
              <span key={di} style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                <span style={{
                  width: 13, height: 13, borderRadius: "50%",
                  background: full ? "var(--accent)" : "transparent",
                  border: full ? "none" : "1.5px solid #d9d9d9",
                }} />
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Q/Y: bars per week (Q) or month (Y) */
function BucketBars({ days, perDay, habit, period }: { days: string[]; perDay: number[]; habit: Habit; period: Period }) {
  const buckets: number[] = [];
  const bucketMax: number[] = [];
  if (period === "Q") {
    let sum = 0, cap = 0;
    days.forEach((d, i) => {
      if (dayOfWeekMon0(d) === 0 && cap) { buckets.push(sum); bucketMax.push(cap); sum = 0; cap = 0; }
      sum += Math.min(habit.timesPerDay, perDay[i]);
      if (habitActiveOn(habit, d)) cap += habit.timesPerDay;
    });
    if (cap) { buckets.push(sum); bucketMax.push(cap); }
  } else {
    const byMonth = new Map<number, [number, number]>();
    days.forEach((d, i) => {
      const m = fromKey(d).getMonth();
      const [s, c] = byMonth.get(m) ?? [0, 0];
      byMonth.set(m, [s + Math.min(habit.timesPerDay, perDay[i]), c + (habitActiveOn(habit, d) ? habit.timesPerDay : 0)]);
    });
    for (const [, [s, c]] of [...byMonth.entries()].sort((a, b) => a[0] - b[0])) {
      buckets.push(s); bucketMax.push(c);
    }
  }
  const yMax = Math.max(...bucketMax, 1);
  const H = 96;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", height: H, borderBottom: "1px solid #eee", position: "relative" }}>
        <YLabels yMax={yMax} />
        {buckets.map((v, i) => (
          <div key={i} style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "flex-end", height: "100%" }}>
            <div style={{ width: 6, borderRadius: 3, height: "100%", background: "#f0f0f0", position: "relative" }}>
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0, borderRadius: 3,
                height: `${(v / yMax) * 100}%`, background: "var(--accent)",
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
