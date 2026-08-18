// Порядок и ключи типов уведомлений. Тексты (label/desc/condition) — в i18n: ntype.<key>.{label,desc,cond}
export const NOTIFICATION_TYPES = [
  { key: "assignment" },
  { key: "overdue" },
  { key: "review" },
  { key: "kpi_reminder" },
  { key: "mention" },
  { key: "daily_plan" },
] as const;
