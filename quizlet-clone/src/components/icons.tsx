import React from "react";

type P = React.SVGProps<SVGSVGElement> & { size?: number };
const S = ({ size = 20, children, ...p }: P & { children: React.ReactNode }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    {children}
  </svg>
);

export const IcCards = (p: P) => (
  <S {...p}>
    <rect x="3" y="5" width="14" height="14" rx="2" />
    <path d="M8 3h11a2 2 0 0 1 2 2v11" />
  </S>
);
export const IcLearn = (p: P) => (
  <S {...p}>
    <path d="M12 2 3 7l9 5 9-5-9-5Z" />
    <path d="M3 7v6l9 5 9-5V7" />
  </S>
);
export const IcTest = (p: P) => (
  <S {...p}>
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </S>
);
export const IcMatch = (p: P) => (
  <S {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </S>
);
export const IcGravity = (p: P) => (
  <S {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
  </S>
);
export const IcSpell = (p: P) => (
  <S {...p}>
    <path d="M12 6v13" />
    <path d="M5 6h14M8 19h8" />
  </S>
);
export const IcStar = ({ filled, ...p }: P & { filled?: boolean }) => (
  <S {...p} fill={filled ? "currentColor" : "none"}>
    <path d="M12 2l2.9 6.3L22 9.3l-5 4.9 1.2 7L12 17.8 5.8 21l1.2-7-5-4.9 7.1-1Z" />
  </S>
);
export const IcSound = (p: P) => (
  <S {...p}>
    <path d="M11 5 6 9H2v6h4l5 4V5Z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />
  </S>
);
export const IcSearch = (p: P) => (
  <S {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </S>
);
export const IcPlus = (p: P) => (
  <S {...p}>
    <path d="M12 5v14M5 12h14" />
  </S>
);
export const IcFolder = (p: P) => (
  <S {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
  </S>
);
export const IcHome = (p: P) => (
  <S {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
  </S>
);
export const IcArrowLeft = (p: P) => (
  <S {...p}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </S>
);
export const IcArrowRight = (p: P) => (
  <S {...p}>
    <path d="M5 12h14M12 5l7 7-7 7" />
  </S>
);
export const IcShuffle = (p: P) => (
  <S {...p}>
    <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
  </S>
);
export const IcPlay = (p: P) => (
  <S {...p}>
    <path d="M6 4l14 8-14 8V4Z" fill="currentColor" />
  </S>
);
export const IcPause = (p: P) => (
  <S {...p}>
    <rect x="6" y="4" width="4" height="16" fill="currentColor" />
    <rect x="14" y="4" width="4" height="16" fill="currentColor" />
  </S>
);
export const IcSettings = (p: P) => (
  <S {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 13.6H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.6V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8Z" />
  </S>
);
export const IcMenu = (p: P) => (
  <S {...p}>
    <path d="M3 6h18M3 12h18M3 18h18" />
  </S>
);
export const IcX = (p: P) => (
  <S {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </S>
);
export const IcEdit = (p: P) => (
  <S {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </S>
);
export const IcTrash = (p: P) => (
  <S {...p}>
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
  </S>
);
export const IcCheck = (p: P) => (
  <S {...p}>
    <path d="M20 6 9 17l-5-5" />
  </S>
);
export const IcFlag = (p: P) => (
  <S {...p}>
    <path d="M4 22V4M4 4h13l-2 4 2 4H4" />
  </S>
);
export const IcBolt = (p: P) => (
  <S {...p}>
    <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" fill="currentColor" />
  </S>
);
