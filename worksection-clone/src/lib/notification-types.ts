export const NOTIFICATION_TYPES = [
  { key: "assignment", label: "Призначення задачі", desc: "Коли керівник ставить задачу співробітнику" },
  { key: "overdue", label: "Прострочені задачі", desc: "Нагадування про задачі, що прострочені" },
  { key: "review", label: "Відправлено на перевірку", desc: "Коли задачу відправляють на перевірку керівнику" },
  { key: "kpi_reminder", label: "Нагадування заповнити KPI", desc: "1–3 числа наступного місяця" },
] as const;
