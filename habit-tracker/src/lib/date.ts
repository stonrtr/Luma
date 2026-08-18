// Все даты — строки YYYY-MM-DD в локальном времени.

export function toStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayStr(): string {
  return toStr(new Date());
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return toStr(d);
}

export function diffDays(a: string, b: string): number {
  const da = new Date(a + "T12:00:00").getTime();
  const db = new Date(b + "T12:00:00").getTime();
  return Math.round((da - db) / 86400000);
}

/** ISO-день недели: 1=Пн … 7=Вс */
export function isoWeekday(dateStr: string): number {
  const wd = new Date(dateStr + "T12:00:00").getDay();
  return wd === 0 ? 7 : wd;
}

/** Понедельник недели, в которую входит дата */
export function mondayOf(dateStr: string): string {
  return addDays(dateStr, 1 - isoWeekday(dateStr));
}

/** Воскресенье недели (последний день) */
export function sundayOf(dateStr: string): string {
  return addDays(mondayOf(dateStr), 6);
}

/** Последний день месяца, в который входит дата */
export function endOfMonth(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return toStr(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/** Первый день месяца */
export function startOfMonth(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return toStr(new Date(d.getFullYear(), d.getMonth(), 1));
}

/** Сдвиг на n месяцев (к 1-му числу) */
export function addMonths(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00");
  return toStr(new Date(d.getFullYear(), d.getMonth() + n, 1));
}

const MONTHS_NOM = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

/** «Август 2026» */
export function monthTitle(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${MONTHS_NOM[d.getMonth()]} ${d.getFullYear()}`;
}

const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const WEEKDAYS_FULL = [
  "Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота",
];

/** «Понедельник, 17 марта» */
export function humanFull(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${WEEKDAYS_FULL[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

/** «16 авг» — число цифрой, месяц коротко */
export function dayMonth(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** «18 августа» — число и месяц словом, без дня недели */
export function dayMonthFull(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export const WD_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/** Короткий ярлык дня недели для даты */
export function wdShort(dateStr: string): string {
  return WD_SHORT[isoWeekday(dateStr) - 1];
}
