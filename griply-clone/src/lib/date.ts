export const DAY_LETTERS = ["П", "В", "С", "Ч", "П", "С", "В"];
export const DAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
export const DAY_FULL = [
  "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье",
];
export const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
export const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

export function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(): string {
  return toKey(new Date());
}

export function addDays(key: string, n: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

/** Понедельник недели, содержащей дату */
export function weekStart(key: string): string {
  const d = fromKey(key);
  const dow = (d.getDay() + 6) % 7; // 0=Пн
  d.setDate(d.getDate() - dow);
  return toKey(d);
}

export function weekDays(start: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function dayOfWeekMon0(key: string): number {
  return (fromKey(key).getDay() + 6) % 7;
}

export function fmtShort(key: string): string {
  const d = fromKey(key);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function fmtDayMon(key: string): string {
  const d = fromKey(key);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function fmtInput(key: string | null | undefined): string {
  return key ?? "";
}

/** Человеческая подпись: Сегодня / Завтра / Среда / 3 сен */
export function fmtHuman(key: string): string {
  const t = todayKey();
  if (key === t) return "Сегодня";
  if (key === addDays(t, 1)) return "Завтра";
  const diff = (fromKey(key).getTime() - fromKey(t).getTime()) / 86400000;
  if (diff > 0 && diff < 7) return DAY_FULL[dayOfWeekMon0(key)];
  return fmtDayMon(key);
}

export function monthLabel(key: string): string {
  return MONTHS[fromKey(key).getMonth()];
}

export function daysBetween(a: string, b: string): number {
  return Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86400000);
}

/** напр. «1 мес», «12 дн» */
export function timeLeft(deadline: string): string {
  const diff = daysBetween(todayKey(), deadline);
  if (diff < 0) return "просрочено";
  if (diff >= 60) return `${Math.round(diff / 30)} мес`;
  if (diff >= 28) return `1 мес`;
  if (diff >= 7) return `${Math.round(diff / 7)} нед`;
  return `${diff} дн`;
}

function plural(n: number, one: string, few: string, many: string): string {
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
  return many;
}

export function timeLeftLong(deadline: string): string {
  const diff = daysBetween(todayKey(), deadline);
  if (diff < 0) return "Просрочено";
  if (diff >= 28) {
    const m = Math.max(1, Math.round(diff / 30));
    return `${plural(m, "Остался", "Осталось", "Осталось")} ${m} ${plural(m, "месяц", "месяца", "месяцев")}`;
  }
  if (diff >= 7) {
    const w = Math.round(diff / 7);
    return `${plural(w, "Осталась", "Осталось", "Осталось")} ${w} ${plural(w, "неделя", "недели", "недель")}`;
  }
  return `${plural(diff, "Остался", "Осталось", "Осталось")} ${diff} ${plural(diff, "день", "дня", "дней")}`;
}

export { plural };
