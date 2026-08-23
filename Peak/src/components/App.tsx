"use client";

import React, { useEffect, useState } from "react";
import { StoreProvider, useStore } from "@/lib/store";
import { todayKey, dayOfWeekMon0 } from "@/lib/date";
import { View } from "@/lib/types";
import Sidebar, { SearchModal, DataMenuItems } from "./Sidebar";
import { SettingsModal, sendTelegram } from "./Settings";
import { MenuItem } from "./ui";
import { PanelLeft, Burger, Check, CalendarUp, Repeat, Target, ChartBars, User } from "./icons";
import { Dropdown } from "./ui";
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
      {!sidebarHidden && (
        <div className="sidebar-desktop">
          <Sidebar view={view} setView={setView} onHide={() => setSidebarHidden(true)} onOpenSettings={() => setSettingsOpen(true)} />
        </div>
      )}

      {mobileMenu && (
        <div className="drawer-backdrop" onClick={(e) => e.target === e.currentTarget && setMobileMenu(false)}>
          <div className="drawer">
            <Sidebar view={view} setView={nav} onHide={() => setMobileMenu(false)} onOpenSettings={() => setSettingsOpen(true)} />
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
          <Dropdown align="right" trigger={<span className="icon-btn"><User size={18} /></span>}>
            {(close) => (
              <>
                <MenuItem onClick={() => { setSettingsOpen(true); close(); }}>Настройки</MenuItem>
                <DataMenuItems close={close} />
              </>
            )}
          </Dropdown>
        </span>
        {content}
        <button className="fab" onClick={fabClick}>+</button>
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
