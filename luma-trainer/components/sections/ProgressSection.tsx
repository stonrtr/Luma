"use client";
import { useEffect, useState } from "react";
import { A, type ProgressData } from "@/lib/api";
import { useApp } from "../app-context";
import { Spinner } from "../ui";

export function ProgressSection() {
  const { refreshKey } = useApp();
  const [data, setData] = useState<ProgressData | null>(null);

  useEffect(() => {
    setData(null);
    A.progress().then(setData).catch(() => {});
  }, [refreshKey]);

  if (!data)
    return (
      <div style={{ display: "grid", placeItems: "center", padding: 60, color: "#fff" }}>
        <Spinner size={26} />
      </div>
    );

  const distLabels = ["0–24%", "25–49%", "50–74%", "75–99%", "Выучено"];
  const maxAct = Math.max(1, ...data.activity7.map((d) => d.reviewed + d.newStudied));
  const maxDist = Math.max(1, ...data.distribution);

  const stats = [
    { n: data.reviewedToday, label: "Повторено сегодня", color: "var(--accent)" },
    { n: data.newToday, label: "Новых сегодня", color: "var(--accent)" },
    { n: data.learnedWeek, label: "Выучено за неделю", color: "var(--success)" },
    { n: data.learnedMonth, label: "Выучено за месяц", color: "var(--success)" },
    { n: data.activePhrases, label: "Активные фразы", color: "var(--accent)" },
    { n: data.attention, label: "Требуют внимания", color: data.attention ? "var(--danger)" : "var(--ink-2)" },
  ];

  return (
    <>
      <div className="title-hero">
        прогресс<span className="dim">.</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        {stats.map((s) => (
          <div key={s.label} className="wcard-sm" style={{ padding: "16px 18px" }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: s.color }}>{s.n}</div>
            <div style={{ color: "var(--ink-2)", fontSize: 13, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="wcard" style={{ padding: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 17, color: "var(--ink)", marginBottom: 14 }}>Активность за 7 дней</div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 140 }}>
          {data.activity7.map((d) => {
            const total = d.reviewed + d.newStudied;
            const h = Math.max(2, (total / maxAct) * 100);
            const day = new Date(d.date + "T00:00:00").toLocaleDateString("ru", { weekday: "short" });
            return (
              <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, justifyContent: "flex-end", height: "100%" }}>
                <div style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 700 }}>{total || ""}</div>
                <div
                  style={{ width: "70%", height: h, borderRadius: 8, display: "flex", flexDirection: "column", justifyContent: "flex-end", overflow: "hidden", background: "var(--track-soft)" }}
                  title={`${d.reviewed} повторено, ${d.newStudied} новых`}
                >
                  <div style={{ height: total ? `${(d.reviewed / total) * 100}%` : 0, background: "var(--accent)" }} />
                  <div style={{ height: total ? `${(d.newStudied / total) * 100}%` : 0, background: "color-mix(in srgb, var(--accent) 40%, #ffffff)" }} />
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-2)", fontWeight: 700 }}>{day}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 12, color: "var(--ink-2)", fontWeight: 600 }}>
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "var(--accent)", borderRadius: 3, marginRight: 4 }} />повторено</span>
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "color-mix(in srgb, var(--accent) 40%, #ffffff)", borderRadius: 3, marginRight: 4 }} />новые</span>
        </div>
      </div>

      <div className="wcard" style={{ padding: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 17, color: "var(--ink)", marginBottom: 14 }}>Распределение по прогрессу</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.distribution.map((n, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "var(--ink-2)", width: 72, fontSize: 13, fontWeight: 600 }}>{distLabels[i]}</span>
              <div style={{ flex: 1, background: "var(--track-soft)", borderRadius: 999, height: 20 }}>
                <div
                  style={{
                    width: `${(n / maxDist) * 100}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: i === 4 ? "var(--success)" : "var(--accent)",
                    minWidth: n ? 4 : 0,
                  }}
                />
              </div>
              <span style={{ width: 28, textAlign: "right", fontWeight: 800, color: "var(--ink)" }}>{n}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
