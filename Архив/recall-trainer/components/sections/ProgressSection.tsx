"use client";
import { useEffect, useState } from "react";
import { A } from "@/lib/api";
import { useApp } from "../app-context";
import { Spinner, EmptyState } from "../ui";
import type { ProgressData } from "@/lib/types";

const DIST_LABELS = ["0–20%", "20–40%", "40–60%", "60–80%", "80–100%"];
const DAY_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

export function ProgressSection() {
  const { refreshKey, goTo } = useApp();
  const [p, setP] = useState<ProgressData | null>(null);

  useEffect(() => {
    setP(null);
    A.progress().then(setP).catch(() => setP(null));
  }, [refreshKey]);

  if (!p) return <div style={{ display: "grid", placeItems: "center", padding: 60 }}><Spinner size={28} /></div>;

  if (p.totalTopics === 0) {
    return (
      <div>
        <h1 className="h1" style={{ marginBottom: 16 }}>Прогресс</h1>
        <EmptyState icon="📈" title="Пока нет данных" hint="Добавьте темы и начните повторять — здесь появится статистика." action={<button className="btn btn-primary" onClick={() => goTo("knowledge")}>К темам</button>} />
      </div>
    );
  }

  const maxActivity = Math.max(1, ...p.activity7.map((a) => a.reviewed));

  return (
    <div>
      <h1 className="h1" style={{ marginBottom: 16 }}>Прогресс</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
        <Stat label="Всего тем" value={p.totalTopics} />
        <Stat label="Выучено" value={p.learnedTotal} tone="success" />
        <Stat label="В изучении" value={p.learningTotal} />
        <Stat label="К повторению" value={p.dueNow} tone="primary" />
        <Stat label="Серия дней" value={p.streak} tone="primary" />
        <Stat label="Выучено за неделю" value={p.learnedWeek} tone="success" />
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div className="h2" style={{ marginBottom: 14 }}>Активность за 7 дней</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120 }}>
          {p.activity7.map((a) => {
            const h = (a.reviewed / maxActivity) * 100;
            const dow = new Date(a.date + "T00:00:00").getDay();
            return (
              <div key={a.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: a.reviewed ? "var(--primary)" : "var(--muted)" }}>{a.reviewed || ""}</div>
                <div style={{ width: "100%", maxWidth: 34, height: `${Math.max(a.reviewed ? 6 : 2, h)}%`, background: a.reviewed ? "linear-gradient(180deg, var(--cyan), var(--primary))" : "color-mix(in srgb, var(--muted) 18%, transparent)", borderRadius: 6, transition: "height .4s ease" }} />
                <div className="muted" style={{ fontSize: 12 }}>{DAY_SHORT[dow]}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div className="h2" style={{ marginBottom: 14 }}>Распределение по прогрессу</div>
        <div style={{ display: "grid", gap: 10 }}>
          {p.distribution.map((count, i) => {
            const pct = p.totalTopics ? (count / p.totalTopics) * 100 : 0;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div className="muted" style={{ width: 72, fontSize: 13, flex: "none" }}>{DIST_LABELS[i]}</div>
                <div className="progress" style={{ flex: 1, height: 14 }}>
                  <span style={{ width: `${pct}%`, background: i === 4 ? "linear-gradient(90deg, #34d399, var(--success))" : undefined }} />
                </div>
                <div style={{ width: 28, textAlign: "right", fontWeight: 700, fontSize: 14, flex: "none" }}>{count}</div>
              </div>
            );
          })}
        </div>
      </div>
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
