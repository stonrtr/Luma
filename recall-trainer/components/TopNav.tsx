"use client";
import { useEffect, useRef, useState } from "react";
import { SECTIONS, type SectionId } from "./app-context";

export function TopNav({
  active,
  onNavigate,
}: {
  active: SectionId;
  onNavigate: (id: SectionId) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Close on Escape (§4).
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const go = (id: SectionId) => {
    onNavigate(id);
    setMenuOpen(false);
  };

  return (
    <>
      <header className="topnav">
        <div className="container">
          <div className="topnav-inner">
            <button
              ref={btnRef}
              className="hamburger"
              aria-label="Меню"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? "✕" : "☰"}
            </button>
            <div className="brand">
              <span className="dot" />
              Recall
            </div>
            <nav className="nav-links">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  className={`nav-link ${active === s.id ? "active" : ""}`}
                  onClick={() => go(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile overlay menu — click outside / select / re-click / Escape all close (§4) */}
      {menuOpen && (
        <div className="mobile-menu" onClick={() => setMenuOpen(false)}>
          <div className="container" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-menu-panel">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  className={`mobile-link ${active === s.id ? "active" : ""}`}
                  onClick={() => go(s.id)}
                >
                  <span>{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
