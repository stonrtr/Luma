// Типы уведомлений: порядок, признак «по расписанию» и дефолтное время.
// Тексты (label/desc/cond) — в i18n: ntype.<key>.{label,desc,cond}.
// scheduled=true → есть время отправки (плановые); false → событийные (шлются в момент действия).
export const NOTIFICATION_TYPES = [
  // событийные
  { key: "assignment", scheduled: false, defaultAt: null },
  { key: "review", scheduled: false, defaultAt: null },
  { key: "review_result", scheduled: false, defaultAt: null },
  { key: "mention", scheduled: false, defaultAt: null },
  // по расписанию (время — минуты от полуночи по Киеву)
  { key: "daily_plan", scheduled: true, defaultAt: 600 },        // 10:00
  { key: "overdue", scheduled: true, defaultAt: 18 * 60 + 59 },  // 18:59
  { key: "kpi_reminder", scheduled: true, defaultAt: 600 },      // 10:00 (1–3 числа)
] as const;

export type NotificationTypeKey = (typeof NOTIFICATION_TYPES)[number]["key"];

export function notificationMeta(key: string) {
  return NOTIFICATION_TYPES.find((t) => t.key === key);
}
