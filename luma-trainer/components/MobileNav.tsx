"use client";
import { SECTIONS, type SectionId } from "./app-context";

// Нижняя таб-панель для мобильных (фикс, стекло, иконка + подпись).
// Показывается только на узких экранах (CSS @media), десктоп — текстовое меню сверху.
export function MobileNav({
  active,
  onNavigate,
}: {
  active: SectionId;
  onNavigate: (id: SectionId) => void;
}) {
  return (
    <nav className="mobile-nav" aria-label="Разделы">
      {SECTIONS.map((s) => (
        <button
          key={s.id}
          className={`mobile-nav-item ${active === s.id ? "active" : ""}`}
          onClick={() => onNavigate(s.id)}
        >
          <span className="mobile-nav-icon">{s.icon}</span>
          <span className="mobile-nav-label">{s.label}</span>
        </button>
      ))}
    </nav>
  );
}
