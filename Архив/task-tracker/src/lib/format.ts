import { format, differenceInCalendarDays } from "date-fns";
import { ru } from "date-fns/locale";

export function formatDueDate(date: Date) {
  return format(date, "d MMM", { locale: ru });
}

export function formatDateTime(date: Date) {
  return format(date, "d MMM yyyy, HH:mm", { locale: ru });
}

function pluralDays(n: number) {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "дня";
  return "дней";
}

export function formatDaysUntil(date: Date) {
  const days = differenceInCalendarDays(date, new Date());
  if (days === 0) return "Сегодня";
  if (days === 1) return "Завтра";
  if (days === -1) return "Вчера";
  if (days > 1) return `${days} ${pluralDays(days)}`;
  return `Просрочено на ${Math.abs(days)} ${pluralDays(days)}`;
}
