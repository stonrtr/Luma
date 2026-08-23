import React from "react";

type P = { size?: number; strokeWidth?: number; className?: string };

function I({ size = 18, strokeWidth = 1.7, className, children }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

export const Inbox = (p: P) => (
  <I {...p}><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></I>
);
export const CalendarDay = (p: P) => (
  <I {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="M9 16l2 2 4-4" /></I>
);
export const CalendarUp = (p: P) => (
  <I {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></I>
);
export const ListIcon = (p: P) => (
  <I {...p}><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" strokeWidth={2.4} /></I>
);
export const Check = (p: P) => <I {...p}><path d="M20 6 9 17l-5-5" /></I>;
export const CheckSmall = (p: P) => <I {...p} size={p.size ?? 12} strokeWidth={p.strokeWidth ?? 3}><path d="M20 6 9 17l-5-5" /></I>;
export const Trash = (p: P) => (
  <I {...p}><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></I>
);
export const Heart = (p: P) => (
  <I {...p}><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z" /></I>
);
export const Target = (p: P) => (
  <I {...p}><path d="M12 8a4 4 0 1 0 4 4" /><path d="M12 2a10 10 0 1 0 10 10" /><path d="M12 12l4-4" /><path d="M16 4v4h4" /></I>
);
export const Repeat = (p: P) => (
  <I {...p}><path d="M17 2l4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></I>
);
export const ChartBars = (p: P) => (
  <I {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></I>
);
export const Search = (p: P) => (
  <I {...p}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></I>
);
export const PanelLeft = (p: P) => (
  <I {...p}><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M9.5 3v18" /></I>
);
export const ChevronDown = (p: P) => <I {...p} size={p.size ?? 14}><path d="m6 9 6 6 6-6" /></I>;
export const ChevronUp = (p: P) => <I {...p} size={p.size ?? 14}><path d="m18 15-6-6-6 6" /></I>;
export const ChevronLeft = (p: P) => <I {...p} size={p.size ?? 16}><path d="m15 18-6-6 6-6" /></I>;
export const ChevronRight = (p: P) => <I {...p} size={p.size ?? 16}><path d="m9 18 6-6-6-6" /></I>;
export const Plus = (p: P) => <I {...p}><path d="M12 5v14M5 12h14" /></I>;
export const Dots = (p: P) => (
  <I {...p} size={p.size ?? 16}><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></I>
);
export const Star = (p: P & { filled?: boolean }) => (
  <svg width={p.size ?? 18} height={p.size ?? 18} viewBox="0 0 24 24"
    fill={p.filled ? "#f5a623" : "none"} stroke={p.filled ? "#f5a623" : "currentColor"}
    strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={p.className}>
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
  </svg>
);
export const ArrowLeft = (p: P) => <I {...p}><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></I>;
export const Flag = (p: P) => <I {...p}><path d="M4 22V4c4-2 8 2 12 0v10c-4 2-8-2-12 0" /></I>;
export const Bolt = (p: P) => <I {...p}><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" /></I>;
export const Clock = (p: P) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></I>;
export const Bell = (p: P) => (
  <I {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></I>
);
export const TagIcon = (p: P) => (
  <I {...p}><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" /><circle cx="7.5" cy="7.5" r="0.5" fill="currentColor" /></I>
);
export const Pencil = (p: P) => (
  <I {...p}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></I>
);
export const InfoCircle = (p: P) => (
  <I {...p} size={p.size ?? 15}><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></I>
);
export const Settings2 = (p: P) => (
  <I {...p}><path d="M20 7h-9M14 17H5" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" /></I>
);
export const FilterLines = (p: P) => (
  <I {...p}><circle cx="12" cy="12" r="9" /><path d="M7 10h10M9 14h6" /></I>
);
export const User = (p: P) => (
  <I {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" /></I>
);
export const MapPin = (p: P) => (
  <I {...p}><path d="M12 22s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></I>
);
export const Send = (p: P) => (
  <I {...p}><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4z" /></I>
);
export const Sun = (p: P) => (
  <I {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></I>
);
export const Moon = (p: P) => (
  <I {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></I>
);
export const Globe = (p: P) => (
  <I {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></I>
);
export const Burger = (p: P) => (
  <I {...p}><path d="M4 6h16M4 12h16M4 18h16" /></I>
);
export const Flame = (p: P) => (
  <I {...p}><path d="M12 22c4.4 0 7-2.7 7-6.4 0-2.5-1.4-4.5-2.6-6-.5 1.1-1.2 1.9-2.1 2.4.3-2.9-1-6.3-4-8.6.2 2.3-.7 4-2 5.5C7 10.5 5 12.5 5 15.6 5 19.3 7.6 22 12 22z" /></I>
);
export const Rocket = (p: P) => (
  <I {...p}><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /></I>
);
export const LineChart = (p: P) => (
  <I {...p}><path d="M3 3v18h18" /><path d="m7 14 4-4 3 3 5-6" /></I>
);
export const Route = (p: P) => (
  <I {...p}><circle cx="6" cy="19" r="2.5" /><circle cx="18" cy="5" r="2.5" /><path d="M8.5 19h6a3.5 3.5 0 0 0 0-7h-5a3.5 3.5 0 0 1 0-7h6" strokeDasharray="3 3" /></I>
);

/* Life area icons */
export const AreaBriefcase = (p: P) => (
  <I {...p}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></I>
);
export const AreaBall = (p: P) => (
  <I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18M3 12h18" /></I>
);
export const AreaCard = (p: P) => (
  <I {...p}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></I>
);
export const AreaPerson = (p: P) => <User {...p} />;
export const AreaSmile = (p: P) => (
  <I {...p}><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><path d="M9 9h.01M15 9h.01" strokeWidth={2.2} /></I>
);
export const AreaBook = (p: P) => (
  <I {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></I>
);
export const AreaPeople = (p: P) => (
  <I {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2 21c0-3.5 3-5.5 7-5.5s7 2 7 5.5" /><path d="M16 3.5a3.5 3.5 0 0 1 0 7" /><path d="M19 15.6c1.9.7 3 2.1 3 4.4" /></I>
);
export const AreaRings = (p: P) => (
  <I {...p}><circle cx="9" cy="13" r="6" /><circle cx="15" cy="13" r="6" /></I>
);
export const AreaLotus = (p: P) => (
  <I {...p}><path d="M12 20c-5 0-9-3-9-7 2 0 4 .7 5.2 1.8C8.5 12 9 8 12 5c3 3 3.5 7 3.8 9.8C17 13.7 19 13 21 13c0 4-4 7-9 7z" /></I>
);

export const AREA_ICONS: Record<string, (p: P) => React.ReactElement> = {
  briefcase: AreaBriefcase,
  ball: AreaBall,
  card: AreaCard,
  person: AreaPerson,
  smile: AreaSmile,
  book: AreaBook,
  people: AreaPeople,
  rings: AreaRings,
  lotus: AreaLotus,
  heart: Heart,
};

export function AreaIcon({ icon, size }: { icon: string; size?: number }) {
  const C = AREA_ICONS[icon] ?? Heart;
  return <C size={size} />;
}
