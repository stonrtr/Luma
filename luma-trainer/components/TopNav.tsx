"use client";
import { SECTIONS, type SectionId } from "./app-context";

// Навигация Bethouse: логотип с подписью, текстовые ссылки-разделы по центру,
// справа «🎲 Random» и белая пилюля «сессия →». На мобильном — flex-wrap.
export function TopNav({
  active,
  onNavigate,
  onStartSession,
  onStartRandom,
}: {
  active: SectionId;
  onNavigate: (id: SectionId) => void;
  onStartSession: () => void;
  onStartRandom: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
        <div className="brand">
          luma<span className="dim">.</span>
        </div>
        <div className="brand-sub">
          Prime learning
          <br />
          platform
        </div>
      </div>
      <nav style={{ display: "flex", gap: "clamp(14px, 2.4vw, 34px)", flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            className={`nav-link ${active === s.id ? "active" : ""}`}
            onClick={() => onNavigate(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button className="gbtn gbtn-sm" onClick={onStartRandom} title="Все фразы в случайном порядке">
          🎲 Random
        </button>
        <button className="wbtn" onClick={onStartSession}>
          сессия →
        </button>
      </div>
    </div>
  );
}
