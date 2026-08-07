// Помощники для отображения дат/времени в часовом поясе пользователя.

// Дата в формате YYYY-MM-DD в заданном часовом поясе
export function zonedDateStr(date: Date, timeZone: string): string {
  // en-CA даёт формат YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

// Минуты от полуночи (0..1439) в заданном часовом поясе
export function zonedMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}
