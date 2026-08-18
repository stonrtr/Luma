export function mondayOf(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Пн = 0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
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
