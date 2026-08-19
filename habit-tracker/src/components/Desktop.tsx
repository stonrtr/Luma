"use client";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { todayOpenTasks } from "@/lib/selectors";
import { Rail } from "./Rail";
import { TodayCenter } from "./TodayCenter";
import { TimeCenter } from "./TimeCenter";
import { GoalCenter } from "./GoalCenter";
import { GoalsOverview } from "./GoalsOverview";
import { HabitsOverview } from "./HabitsOverview";
import { CalendarCenter } from "./CalendarCenter";
import { HabitsRail } from "./HabitsRail";
import { Modals, type ModalState } from "./modals";

// «страничные» view, не привязанные к конкретной цели
const PAGE_VIEWS = ["today", "week", "month", "future", "goals", "calendar", "habits"] as const;

export function Desktop() {
  const { state, toggleTask } = useStore();
  const [view, setView] = useState<string>("today");
  const [modal, setModal] = useState<ModalState>(null);
  const [sel, setSel] = useState(0);

  // если выбранная цель исчезла (архив) — вернуться на «Сегодня»
  useEffect(() => {
    const isPage = (PAGE_VIEWS as readonly string[]).includes(view);
    if (!isPage && !state.goals.some((g) => g.id === view)) setView("today");
  }, [state.goals, view]);

  const closeModal = useCallback(() => setModal(null), []);
  const isGoalView = !(PAGE_VIEWS as readonly string[]).includes(view);
  const openCreate = () => setModal({ kind: "create", goalId: isGoalView ? view : null });
  const openTask = (id: string) => setModal({ kind: "task", id });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "n" || e.key === "N" || e.key === "т" || e.key === "Т") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setModal({ kind: "create", goalId: null });
        return;
      }
      if (e.key === "Escape") {
        setModal(null);
        return;
      }
      const el = document.activeElement;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA");
      if (modal || typing) return;

      if (view === "today") {
        const open = todayOpenTasks(state);
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSel((i) => Math.min(open.length - 1, i + 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSel((i) => Math.max(0, i - 1));
        } else if (e.key === " ") {
          e.preventDefault();
          const t = open[sel];
          if (t) toggleTask(t.id, true);
        }
      }
      if (/^[1-9]$/.test(e.key)) {
        const g = state.goals.filter((x) => x.status === "active")[Number(e.key) - 1];
        if (g) {
          setView(g.id);
          setSel(0);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal, view, state, sel, toggleTask]);

  const openTasks = todayOpenTasks(state);
  const selectedId = view === "today" && openTasks[sel] ? openTasks[sel].id : null;

  return (
    <div className="page">
      <div className="shell">
        <span className="shell-bar" />
        <div className="app">
          <Rail
            view={view}
            onSelect={(v) => {
              setView(v);
              setSel(0);
            }}
            onAddGoal={() => setModal({ kind: "goal" })}
          />

          <main>
            {view === "today" ? (
              <TodayCenter selectedId={selectedId} onOpenTask={openTask} />
            ) : view === "week" || view === "month" || view === "future" ? (
              <TimeCenter horizon={view} onOpenTask={openTask} />
            ) : view === "goals" ? (
              <GoalsOverview onOpenGoal={(id) => setView(id)} onAddGoal={() => setModal({ kind: "goal" })} />
            ) : view === "calendar" ? (
              <CalendarCenter onAddForDate={(date) => setModal({ kind: "create", date })} />
            ) : view === "habits" ? (
              <HabitsOverview />
            ) : (
              <GoalCenter goalId={view} onOpenTask={openTask} />
            )}
          </main>

          <HabitsRail view={view} onOpen={() => setView("habits")} />
        </div>
      </div>

      <button className="fab" onClick={openCreate} aria-label="Создать задачу или привычку" title="Создать (⌘N)">
        +
      </button>

      <Modals modal={modal} onClose={closeModal} />
    </div>
  );
}
