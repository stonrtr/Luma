// Помощники для отображения дат/времени в часовом поясе пользователя.

// Дата в формате YYYY-MM-DD в заданном часовом поясе
export function zonedDateStr(date: Date, timeZone: string): string {
  // en-CA даёт формат YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

// День недели в часовом поясе: 1=Пн … 7=Вс
export function zonedWeekday(date: Date, timeZone: string): number {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return map[wd] ?? 1;
}

// Минуты от полуночи (0..1439) в заданном часовом поясе
export function zonedMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

// Стенное время («что на часах у пользователя») в заданной зоне → момент UTC.
// Сервер может жить в любой TZ (на Vercel — UTC), поэтому new Date("YYYY-MM-DDTHH:MM")
// там даёт сдвиг. Двухшаговая коррекция закрывает и переходы на летнее время.
export function zonedTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = (timeStr || "00:00").split(":").map(Number);
  const target = Date.UTC(y, (mo || 1) - 1, d || 1, h || 0, mi || 0);
  const wallUtc = (ts: number) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(ts));
    const get = (t: string) => Number(parts.find((x) => x.type === t)?.value ?? "0");
    return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  };
  let ts = target - (wallUtc(target) - target);
  ts -= wallUtc(ts) - target;
  return new Date(ts);
}
