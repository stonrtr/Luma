export function mondayOf(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Пн = 0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Снап любой даты к понедельнику 00:00 UTC — чистая UTC-арифметика, без TZ среды.
// Маркер недели одинаков на любом сервере (Vercel=UTC, локально=любая TZ).
export function mondayUtc(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (x.getUTCDay() + 6) % 7; // Пн = 0
  x.setUTCDate(x.getUTCDate() - day);
  return x;
}

// Понедельник недели ПОЛЬЗОВАТЕЛЯ как маркер 00:00 UTC: берём его «сегодня»
// в его часовом поясе и снапим к понедельнику. Неделя всегда «по сотруднику».
export function weekStartInTz(timeZone: string, ref: Date = new Date()): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(ref);
  return mondayUtc(new Date(`${ymd}T00:00:00.000Z`));
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const WEEK_BCP: Record<string, string> = { uk: "uk-UA", ru: "ru-RU", en: "en-US" };

export function monthLabel(month: number, locale = "uk"): string {
  const s = new Date(2020, ((month % 12) + 12) % 12, 1).toLocaleDateString(WEEK_BCP[locale] ?? "uk-UA", { month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Номер ISO-недели (1..53)
export function isoWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Пн = 0
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // ближайший четверг
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const diff = date.getTime() - firstThursday.getTime();
  return 1 + Math.round(diff / (7 * 86400000));
}

export function weekLabel(weekStart: Date, locale = "uk"): string {
  const end = addDays(weekStart, 6);
  const f = (d: Date) => d.toLocaleDateString(WEEK_BCP[locale] ?? "uk-UA", { day: "numeric", month: "short" });
  return `${f(weekStart)} — ${f(end)}`;
}
