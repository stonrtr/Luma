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

const MONTHS_UK = [
  "Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень",
  "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень",
];

export function monthLabel(month: number): string {
  return MONTHS_UK[month] ?? "";
}

export function weekLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  const f = (d: Date) => d.toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
  return `${f(weekStart)} — ${f(end)}`;
}
