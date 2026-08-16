// Каталог грамматических тем по уровням CEFR (A2–C2).
// Порядок отражает типичную программу: не перепрыгиваем уровни.
// Название темы = поисковый запрос, который уходит в генератор правил (query).

export type CefrLevel = "A2" | "B1" | "B2" | "C1" | "C2";

export const CEFR_CATALOG: { level: CefrLevel; caption: string; topics: string[] }[] = [
  {
    level: "A2",
    caption: "Базовая грамматика",
    topics: [
      "Present Simple и Present Continuous",
      "Past Simple: правильные и неправильные глаголы",
      "be going to и will — будущее время",
      "Present Perfect (базовый)",
      "Сравнительная и превосходная степень прилагательных",
      "Модальные глаголы: can, could, must, should",
      "Countable/uncountable: some, any, much, many",
      "Предлоги времени и места: at, in, on",
    ],
  },
  {
    level: "B1",
    caption: "Уверенный средний",
    topics: [
      "Present Perfect vs Past Simple",
      "Present Perfect Continuous",
      "Past Continuous vs Past Simple",
      "First и Second Conditional",
      "Пассивный залог: present и past",
      "used to и would — прошлые привычки",
      "Relative clauses: who, which, that",
      "Gerund и infinitive (базовый выбор)",
    ],
  },
  {
    level: "B2",
    caption: "Выше среднего",
    topics: [
      "Third Conditional и mixed conditionals",
      "Past Perfect и Past Perfect Continuous",
      "Future Continuous и Future Perfect",
      "Causative: have/get something done",
      "Reported speech (полный)",
      "Modals of deduction: must/might/can't have done",
      "wish и if only",
      "Discourse markers и linking words",
    ],
  },
  {
    level: "C1",
    caption: "Продвинутый",
    topics: [
      "Inversion: never have I, not only…",
      "Cleft sentences: it was… / what I need is…",
      "Participle clauses",
      "Subjunctive и unreal past",
      "Nominalisation (превращение в существительные)",
      "Hedging: осторожные, дипломатичные формулировки",
      "Ellipsis и substitution",
      "Emphasis: do/does для усиления",
    ],
  },
  {
    level: "C2",
    caption: "Владение в совершенстве",
    topics: [
      "Advanced inversion и fronting для акцента",
      "Impersonal и complex passive структуры",
      "Subjunctive в формальном и идиоматичном стиле",
      "Идиоматичные условные конструкции",
      "Тонкая модальность и оттенки предположения",
      "Cohesion: связность академического текста",
      "Смена регистра: формальный ↔ разговорный",
      "Стилистическая инверсия и эмфаза",
    ],
  },
];
