"use client";
import { SECTIONS, type SectionId } from "./app-context";
import { SectionIcon } from "./section-icons";

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
      {/* «Настройки» вынесены в шестерёнку в правом верхнем углу (TopNav). */}
      {SECTIONS.filter((s) => s.id !== "settings").map((s) => (
        <button
          key={s.id}
          className={`mobile-nav-item ${active === s.id ? "active" : ""}`}
          onClick={() => onNavigate(s.id)}
        >
          <span className="mobile-nav-icon"><SectionIcon id={s.id} size={22} /></span>
          <span className="mobile-nav-label">{s.label}</span>
        </button>
      ))}
    </nav>
  );
}
