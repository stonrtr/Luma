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
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon-192.png"
          alt="Luma"
          width={40}
          height={40}
          style={{ borderRadius: 11, display: "block", boxShadow: "0 6px 16px rgba(2,20,90,0.28)" }}
        />
        <div className="brand" style={{ display: "flex", alignItems: "center", lineHeight: 1 }}>
          luma<span className="dim">.</span>
        </div>
        <div className="brand-sub" style={{ alignSelf: "center" }}>
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
