"use client";

import React, { useEffect, useRef, useState } from "react";
import { StoreProvider, useStore } from "@/lib/store";
import { todayKey, dayOfWeekMon0 } from "@/lib/date";
import { View } from "@/lib/types";
import Sidebar, { SearchModal } from "./Sidebar";
import { SettingsModal, sendTelegram } from "./Settings";
import { taskHash } from "@/lib/google";
import { PanelLeft, Burger, Check, CalendarUp, Repeat, Target, ChartBars, User, Plus } from "./icons";
import { InboxView, TodayView, UpcomingView, AllTasksView, CompletedView, TrashView, TagView } from "./TaskViews";
import { GoalsView, GoalDetail } from "./Goals";
import { LifeAreasView, AreaDetail } from "./LifeAreas";
import { HabitsView } from "./Habits";
import { InsightsView } from "./Insights";

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

const TASK_KINDS = ["inbox", "today", "all", "completed", "trash"];

/** Планировщик напоминаний: раз в 20 сек сверяет время задач и привычек */
function ReminderScheduler() {
  const { data } = useStore();
  const fired = React.useRef<Set<string>>(new Set());
  useEffect(() => {
    const tick = () => {
      const s = data.settings;
      const notifOn = !!s?.notifications && typeof Notification !== "undefined" && Notification.permission === "granted";
      const tg = s?.telegram;
      const tgOn = !!(tg?.enabled && tg.token && tg.chatId);
      if (!notifOn && !tgOn) return;
      const notify = (title: string, body: string) => {
        if (notifOn) new Notification(title, { body });
        if (tgOn) sendTelegram(tg!.token, tg!.chatId, `${title}: ${body}`);
      };
      const now = new Date();
      const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const t = todayKey();
      for (const task of data.tasks) {
        if (!task.reminder || task.completedAt || task.deletedAt) continue;
        if (task.date === t && task.timeStart === hm) {
          const key = `t:${task.id}:${t}`;
          if (!fired.current.has(key)) {
            fired.current.add(key);
            notify("Задача", task.title);
          }
        }
      }
      for (const h of data.habits) {
        if (!h.reminder || h.archived || !h.time || h.time !== hm) continue;
        if (t < h.startDate || (h.endDate && t > h.endDate)) continue;
        if (h.schedule === "custom" && !h.daysOfWeek.includes(dayOfWeekMon0(t))) continue;
        const log = data.habitLogs.find((l) => l.habitId === h.id && l.date === t);
        if ((log?.count ?? 0) >= h.timesPerDay) continue;
        const key = `h:${h.id}:${t}`;
        if (!fired.current.has(key)) {
          fired.current.add(key);
          notify("Привычка", h.name);
        }
      }
    };
    const id = setInterval(tick, 20000);
    tick();
    return () => clearInterval(id);
  }, [data]);
  return null;
}

/** Захват идей из Telegram через serverless-вебхук: бот отвечает мгновенно даже при
 *  закрытом приложении, а приложение забирает накопленные идеи из Upstash через /api/ideas.
 *  «!текст» — задача на сегодня. */
function TelegramCapture() {
  const { data, addTask } = useStore();
  const addRef = useRef(addTask); addRef.current = addTask;
  const cb = data.settings?.captureBot;
  const enabled = cb?.enabled;
  const syncKey = cb?.syncKey;
  const apiBase = (cb?.apiBase ?? "").replace(/\/$/, "");

  useEffect(() => {
    if (!enabled || !syncKey) return;
    let stopped = false;
    const pull = async () => {
      try {
        const r = await fetch(`${apiBase}/api/ideas?key=${encodeURIComponent(syncKey)}`);
        const j = await r.json();
        if (j?.ok && Array.isArray(j.ideas)) {
          for (const it of j.ideas) {
            const title = String(it?.title ?? "").trim();
            if (title) addRef.current({ title, date: it?.today ? todayKey() : null });
          }
        }
      } catch { /* нет сети/функции — тихо повторим */ }
    };
    pull();
    const id = setInterval(() => { if (!stopped) pull(); }, 10000);
    return () => { stopped = true; clearInterval(id); };
  }, [enabled, syncKey, apiBase]);
  return null;
}

/** Google Calendar (серверная интеграция, как в workspace): задачи с датой пишутся
 *  в выделенный календарь «Done» через /api/gcal/push, а события этого календаря
 *  читаются обратно в ленту через /api/gcal/events. Токены хранит сервер (Upstash). */
function GoogleSync() {
  const { data, updateTask, set } = useStore();
  const dataRef = useRef(data); dataRef.current = data;
  const updRef = useRef(updateTask); updRef.current = updateTask;
  const setRef = useRef(set); setRef.current = set;
  const busy = useRef(false);
  const g = data.settings?.google;
  const sk = data.settings?.captureBot?.syncKey;
  const base = (data.settings?.captureBot?.apiBase ?? "").replace(/\/$/, "");
  const enabled = g?.enabled && !!sk;

  // Запись: реконсиляция задач с датой → события в календаре «Done».
  useEffect(() => {
    if (!enabled) return;
    let stop = false;
    const push = async (op: string, t: import("@/lib/types").Task) => {
      const r = await fetch(`${base}/api/gcal/push`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: sk, op, gid: t.googleEventId ?? undefined, title: t.title, date: t.date, timeStart: t.timeStart, timeEnd: t.timeEnd, notes: t.notes }),
      });
      return r.json();
    };
    const reconcile = async () => {
      if (busy.current || stop) return;
      busy.current = true;
      try {
        for (const t of dataRef.current.tasks) {
          if (stop) break;
          const active = !t.deletedAt && !t.completedAt && !!t.date;
          const h = taskHash({ title: t.title, date: t.date ?? "", timeStart: t.timeStart, timeEnd: t.timeEnd, notes: t.notes });
          if (active) {
            if (!t.googleEventId) {
              const j = await push("upsert", t);
              if (j?.gid) updRef.current(t.id, { googleEventId: j.gid, googleHash: h });
            } else if (t.googleHash !== h) {
              const j = await push("upsert", t);
              if (j?.ok) updRef.current(t.id, { googleEventId: j.gid ?? t.googleEventId, googleHash: h });
            }
          } else if (t.googleEventId) {
            await push("delete", t);
            updRef.current(t.id, { googleEventId: null, googleHash: undefined });
          }
        }
      } catch { /* сеть/не подключено — позже */ } finally {
        busy.current = false;
      }
    };
    reconcile();
    const id = setInterval(reconcile, 8000);
    return () => { stop = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sk, base]);

  // Чтение: события выделенного календаря → в ленту (calendarEvents, source="google").
  useEffect(() => {
    if (!enabled) return;
    let stop = false;
    const pull = async () => {
      try {
        const r = await fetch(`${base}/api/gcal/events?key=${encodeURIComponent(sk!)}`);
        const j = await r.json();
        if (j?.ok && j.connected && Array.isArray(j.events)) {
          setRef.current((d) => {
            const nonG = (d.calendarEvents ?? []).filter((e) => e.source !== "google");
            const gev = j.events.map((e: { gid: string; title: string; date: string; timeStart?: string | null; timeEnd?: string | null; htmlLink?: string | null }) => ({
              id: `g:${e.gid}`, gid: e.gid, source: "google" as const, title: e.title, date: e.date, timeStart: e.timeStart ?? null, timeEnd: e.timeEnd ?? null, htmlLink: e.htmlLink ?? null,
            }));
            return { ...d, calendarEvents: [...nonG, ...gev] };
          });
        }
      } catch { /* сеть — позже */ }
    };
    pull();
    const id = setInterval(() => { if (!stop) pull(); }, 60000);
    return () => { stop = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sk, base]);
  return null;
}

function Shell() {
  const [view, setView] = useState<View>({ kind: "today" });
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const nav = (v: View) => {
    setView(v);
    setMobileMenu(false);
  };

  useEffect(() => {
    const open = () => setSettingsOpen(true);
    window.addEventListener("done:open-settings", open);
    return () => window.removeEventListener("done:open-settings", open);
  }, []);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "n" || e.key === "q" || e.key === "т" || e.key === "й") {
        e.preventDefault();
        fabClick();
      } else if (e.key === "/") {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key >= "1" && e.key <= "5") {
        const map: View[] = [
          { kind: "today" }, { kind: "upcoming" }, { kind: "habits" }, { kind: "goals" }, { kind: "insights" },
        ];
        setView(map[Number(e.key) - 1]);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fabClick = () => {
    const inp = document.querySelector<HTMLInputElement>(".main .add-task input, .main .composer input.c-title");
    if (inp) {
      inp.focus();
      inp.scrollIntoView({ block: "center" });
      return;
    }
    document.querySelector<HTMLButtonElement>(".main .page-head .btn-primary")?.click();
  };

  let content: React.ReactNode;
  switch (view.kind) {
    case "inbox": content = <InboxView />; break;
    case "today": content = <TodayView />; break;
    case "upcoming": content = <UpcomingView />; break;
    case "all": content = <AllTasksView />; break;
    case "completed": content = <CompletedView />; break;
    case "trash": content = <TrashView />; break;
    case "areas": content = <LifeAreasView setView={setView} />; break;
    case "area": content = <AreaDetail id={view.id} tab={view.tab} setView={setView} />; break;
    case "goals": content = <GoalsView setView={setView} />; break;
    case "goal": content = <GoalDetail id={view.id} tab={view.tab} setView={setView} />; break;
    case "habits": content = <HabitsView />; break;
    case "insights": content = <InsightsView />; break;
    case "tag": content = <TagView id={view.id} />; break;
  }

  return (
    <div className="shell">
      <ReminderScheduler />
      <TelegramCapture />
      <GoogleSync />
      {!sidebarHidden && (
        <div className="sidebar-desktop">
          <Sidebar view={view} setView={setView} onHide={() => setSidebarHidden(true)} onOpenSettings={() => setSettingsOpen(true)} />
        </div>
      )}

      {mobileMenu && (
        <div className="drawer-backdrop" onClick={(e) => e.target === e.currentTarget && setMobileMenu(false)}>
          <div className="drawer">
            <Sidebar view={view} setView={nav} onHide={() => setMobileMenu(false)} onOpenSettings={() => { setMobileMenu(false); setSettingsOpen(true); }} />
          </div>
        </div>
      )}

      <div className="main" style={sidebarHidden ? { margin: "8px 12px 0 12px" } : undefined}>
        {sidebarHidden && (
          <button className="icon-btn sidebar-reopen" title="Показать меню" onClick={() => setSidebarHidden(false)}>
            <PanelLeft size={17} />
          </button>
        )}
        <button className="icon-btn mobile-burger" onClick={() => setMobileMenu(true)}>
          <Burger size={20} />
        </button>
        <span className="mobile-avatar">
          <button className="icon-btn" onClick={() => setSettingsOpen(true)}><User size={18} /></button>
        </span>
        {content}
        <button className="fab" onClick={fabClick}><Plus size={26} /></button>
      </div>

      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} setView={nav} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

      <nav className="tabbar">
        <button className={TASK_KINDS.includes(view.kind) ? "active" : ""} onClick={() => nav({ kind: "today" })}>
          <Check size={20} /><span>Задачи</span>
        </button>
        <button className={view.kind === "upcoming" ? "active" : ""} onClick={() => nav({ kind: "upcoming" })}>
          <CalendarUp size={20} /><span>Календарь</span>
        </button>
        <button className={view.kind === "habits" ? "active" : ""} onClick={() => nav({ kind: "habits" })}>
          <Repeat size={20} /><span>Привычки</span>
        </button>
        <button className={["goals", "goal", "areas", "area"].includes(view.kind) ? "active" : ""} onClick={() => nav({ kind: "goals" })}>
          <Target size={20} /><span>Цели</span>
        </button>
        <button className={view.kind === "insights" ? "active" : ""} onClick={() => nav({ kind: "insights" })}>
          <ChartBars size={20} /><span>Аналитика</span>
        </button>
      </nav>
    </div>
  );
}
