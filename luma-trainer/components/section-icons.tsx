"use client";
import type { SectionId } from "./app-context";

// Контурные иконки разделов (Feather/Lucide-стиль, наследуют цвет через currentColor).
export function SectionIcon({ id, size = 20 }: { id: SectionId; size?: number }) {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (id) {
    case "today": // солнце
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="4.5" />
          <line x1="12" y1="1.5" x2="12" y2="3.5" />
          <line x1="12" y1="20.5" x2="12" y2="22.5" />
          <line x1="4.2" y1="4.2" x2="5.6" y2="5.6" />
          <line x1="18.4" y1="18.4" x2="19.8" y2="19.8" />
          <line x1="1.5" y1="12" x2="3.5" y2="12" />
          <line x1="20.5" y1="12" x2="22.5" y2="12" />
          <line x1="4.2" y1="19.8" x2="5.6" y2="18.4" />
          <line x1="18.4" y1="5.6" x2="19.8" y2="4.2" />
        </svg>
      );
    case "lessons": // книга
      return (
        <svg {...p}>
          <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v15H6.5A2.5 2.5 0 0 0 4 19.5z" />
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20v5H6.5A2.5 2.5 0 0 1 4 19.5z" />
        </svg>
      );
    case "phrases": // облачко-реплика
      return (
        <svg {...p}>
          <path d="M21 11.5a8 8 0 0 1-11.4 7.2L3 21l2.3-6.6A8 8 0 1 1 21 11.5z" />
        </svg>
      );
    case "listen": // наушники
      return (
        <svg {...p}>
          <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
          <rect x="2.5" y="14" width="4.5" height="7" rx="1.6" />
          <rect x="17" y="14" width="4.5" height="7" rx="1.6" />
        </svg>
      );
    case "progress": // восходящий тренд
      return (
        <svg {...p}>
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
      );
    case "settings": // горизонтальные слайдеры
      return (
        <svg {...p}>
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
          <circle cx="8" cy="6" r="2.2" fill="var(--base)" />
          <circle cx="15" cy="12" r="2.2" fill="var(--base)" />
          <circle cx="9" cy="18" r="2.2" fill="var(--base)" />
        </svg>
      );
    default:
      return null;
  }
}
