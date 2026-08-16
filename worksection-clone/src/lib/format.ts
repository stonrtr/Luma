// app-locale (uk/ru/en) → BCP-47 для Intl
const BCP: Record<string, string> = { uk: "uk-UA", ru: "ru-RU", en: "en-US" };
const bcp = (locale?: string) => BCP[locale ?? "uk"] ?? "uk-UA";
// единицы времени по локали
const UNITS: Record<string, { h: string; m: string }> = {
  uk: { h: "год", m: "хв" }, ru: { h: "ч", m: "м" }, en: { h: "h", m: "m" },
};

export function formatDate(date: Date | string | null | undefined, locale?: string): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(bcp(locale), { day: "numeric", month: "short", year: "numeric" });
}

// Относительное время «щойно / 5 хв тому / 2 год тому / вчора / 3 дн тому», иначе — дата+время.
export function timeAgo(date: Date | string | null | undefined, locale?: string): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const diffSec = Math.round((Date.now() - d.getTime()) / 1000);
  const loc = locale ?? "uk";
  if (diffSec < 45) return { uk: "щойно", ru: "только что", en: "just now" }[loc] ?? "щойно";
  const rtf = new Intl.RelativeTimeFormat(bcp(locale), { numeric: "auto" });
  const min = Math.round(diffSec / 60);
  if (min < 60) return rtf.format(-min, "minute");
  const hr = Math.round(diffSec / 3600);
  if (hr < 24) return rtf.format(-hr, "hour");
  const day = Math.round(diffSec / 86400);
  if (day < 7) return rtf.format(-day, "day");
  // давно — показываем дату и время
  return d.toLocaleString(bcp(locale), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function formatShortDate(date: Date | string | null | undefined, locale?: string): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(bcp(locale), { day: "numeric", month: "short" });
}

export function formatMinutes(minutes: number, locale?: string): string {
  const u = UNITS[locale ?? "uk"] ?? UNITS.uk;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}${u.m}`;
  if (m === 0) return `${h}${u.h}`;
  return `${h}${u.h} ${m}${u.m}`;
}

export function formatMoney(value: number | null | undefined, locale?: string): string {
  if (value == null) return "—";
  return value.toLocaleString(bcp(locale), { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function isOverdue(due: Date | string | null | undefined): boolean {
  if (!due) return false;
  const d = typeof due === "string" ? new Date(due) : due;
  return d.getTime() < Date.now();
}
