"use client";
import { useEffect, useState } from "react";
import { A } from "@/lib/api";
import { useApp } from "../app-context";
import { EmptyState, Spinner } from "../ui";
import type { Knowledge, ProgressData } from "@/lib/types";

export function TodaySection() {
  const { startStudy, goTo, refreshKey } = useApp();
  const [queue, setQueue] = useState<Knowledge[] | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);

  useEffect(() => {
    let alive = true;
    setQueue(null);
    Promise.all([A.study("today"), A.progress()])
      .then(([s, p]) => {
        if (!alive) return;
        setQueue(s.cards);
        setProgress(p);
      })
      .catch(() => alive && setQueue([]));
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  if (queue === null) {
    return (
      <div style={{ display: "grid", placeItems: "center", padding: 60 }}>
        <Spinner size={28} />
      </div>
    );
  }

  const dueCount = queue.length;
  const total = progress?.totalTopics ?? 0;

  return (
    <div>
      <h1 className="h1" style={{ marginBottom: 4 }}>Сегодня</h1>
      <p className="muted" style={{ marginTop: 0, marginBottom: 20 }}>
        {new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
      </p>

      {total === 0 ? (
        <EmptyState
          icon="📚"
          title="Пока нет ни одной темы"
          hint="Добавьте тему: вставьте конспект — и Recall составит по нему вопрос для припоминания."
          action={
            <button className="btn btn-primary" onClick={() => goTo("knowledge")}>
              + Добавить тему
            </button>
          }
        />
      ) : dueCount === 0 ? (
        <EmptyState
          icon="✅"
          title="На сегодня всё повторено"
          hint="Новые темы к повторению появятся, когда придёт их срок. Можно устроить свободное повторение всех тем."
          action={
            <button
              className="btn"
              onClick={() => startStudy({ scope: "all", title: "Все темы" })}
            >
              Повторить все темы
            </button>
          }
        />
      ) : (
        <div className="card" style={{ padding: 28, textAlign: "center" }}>
          <div style={{ fontSize: 52, fontWeight: 800, color: "var(--primary)", lineHeight: 1 }}>
            {dueCount}
          </div>
          <div className="muted" style={{ marginTop: 6, marginBottom: 20 }}>
            {plural(dueCount, "тема ждёт", "темы ждут", "тем ждут")} повторения
          </div>
          <button
            className="btn btn-primary"
            style={{ minWidth: 220, minHeight: 52, fontSize: 17 }}
            onClick={() => startStudy({ scope: "today", title: "Сегодня" })}
          >
            Начать повторение
          </button>
        </div>
      )}

      {progress && total > 0 && (
        <div className="grid-stats" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginTop: 20 }}>
          <Stat label="Всего тем" value={progress.totalTopics} />
          <Stat label="Выучено" value={progress.learnedTotal} tone="success" />
          <Stat label="Повторено сегодня" value={progress.reviewedToday} />
          <Stat label="Серия дней" value={progress.streak} tone="primary" />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" | "primary" }) {
  const color = tone === "success" ? "var(--success)" : tone === "primary" ? "var(--primary)" : "var(--text)";
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
      <div className="muted" style={{ fontSize: 13 }}>{label}</div>
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
