"use client";
import { SECTIONS, type SectionId } from "./app-context";

// Навигация редизайна: логотип, пилюли разделов по центру, «▶ сессия» справа.
// На мобильном всё переносится через flex-wrap (гамбургера в новом дизайне нет).
export function TopNav({
  active,
  onNavigate,
  onStartSession,
}: {
  active: SectionId;
  onNavigate: (id: SectionId) => void;
  onStartSession: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
      <div className="brand">
        luma<span className="dim">.</span>
      </div>
      <nav style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        {SECTIONS.map((s) => {
          const isActive = active === s.id;
          return (
            <button
              key={s.id}
              className={isActive ? "wbtn wbtn-sm" : "gbtn gbtn-sm"}
              style={{ minHeight: 42, fontWeight: isActive ? 800 : 700 }}
              onClick={() => onNavigate(s.id)}
            >
              {s.label}
            </button>
          );
        })}
      </nav>
      <button className="wbtn" onClick={onStartSession}>
        ▶ сессия
      </button>
    </div>
  );
}
