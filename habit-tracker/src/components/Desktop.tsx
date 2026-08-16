"use client";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { todayOpenTasks } from "@/lib/selectors";
import { Rail } from "./Rail";
import { TodayCenter } from "./TodayCenter";
import { TimeCenter } from "./TimeCenter";
import { GoalCenter } from "./GoalCenter";
import { HabitsRail } from "./HabitsRail";
import { Modals, type ModalState } from "./modals";

const HORIZONS = ["today", "week", "month", "future"] as const;

export function Desktop() {
  const { state, toggleTask } = useStore();
  const [view, setView] = useState<string>("today");
  const [modal, setModal] = useState<ModalState>(null);
  const [sel, setSel] = useState(0);

  // если выбранная цель исчезла (закрыта/архив) — вернуться на «Сегодня»
  useEffect(() => {
    const isHorizon = (HORIZONS as readonly string[]).includes(view);
    if (!isHorizon && !state.goals.some((g) => g.id === view)) setView("today");
  }, [state.goals, view]);

  const closeModal = useCallback(() => setModal(null), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "n" || e.key === "N" || e.key === "т" || e.key === "Т") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setModal({ kind: "task" });
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
          <TodayCenter selectedId={selectedId} onQuickAdd={() => setModal({ kind: "task" })} />
        ) : view === "week" || view === "month" || view === "future" ? (
          <TimeCenter horizon={view} />
        ) : (
          <GoalCenter goalId={view} onAddHabit={(goalId) => setModal({ kind: "habit", goalId })} />
        )}
      </main>

      <HabitsRail view={view} />

      <Modals modal={modal} onClose={closeModal} />
    </div>
  );
}
