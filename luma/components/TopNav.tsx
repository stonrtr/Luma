"use client";
import { SECTIONS, type SectionId } from "./app-context";
import { SectionIcon } from "./section-icons";

// Шестерёнка настроек (в правом верхнем углу).
function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

// Навигация Bethouse: логотип с подписью, текстовые ссылки-разделы по центру,
// справа «🎲 Random» и белая пилюля «сессия →». На мобильном — flex-wrap.
export function TopNav({
  active,
  onNavigate,
  onStartRandom,
}: {
  active: SectionId;
  onNavigate: (id: SectionId) => void;
  onStartRandom: () => void;
}) {
  return (
    <div className="top-nav" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={() => onNavigate("today")}
        aria-label="На главную (Сегодня)"
        style={{ display: "flex", alignItems: "center", gap: 12, background: "none", border: "none", padding: 0, cursor: "pointer" }}
      >
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
        <div className="brand-sub" style={{ alignSelf: "center", textAlign: "left" }}>
          Prime learning
          <br />
          platform
        </div>
      </button>
      <nav className="top-nav-links" style={{ display: "flex", gap: "clamp(14px, 2.4vw, 34px)", flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
        {SECTIONS.filter((s) => s.id !== "settings").map((s) => (
          <button
            key={s.id}
            className={`nav-link ${active === s.id ? "active" : ""}`}
            onClick={() => onNavigate(s.id)}
          >
            <SectionIcon id={s.id} size={18} />
            {s.label}
          </button>
        ))}
      </nav>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button className="gbtn gbtn-sm nav-random" onClick={onStartRandom} title="Все фразы в случайном порядке">
          🎲 Random
        </button>
        <button
          className="icon-btn"
          style={{
            width: 42,
            height: 42,
            background: active === "settings" ? "#fff" : undefined,
            color: active === "settings" ? "var(--deep)" : undefined,
          }}
          onClick={() => onNavigate("settings")}
          aria-label="Настройки"
          title="Настройки"
        >
          <GearIcon />
        </button>
      </div>
    </div>
  );
}
