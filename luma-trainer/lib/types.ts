// Shared domain types (spec §27). These are the *serialized* shapes the API
// returns to the client — JSON-string columns are already parsed into arrays/objects.

export type Rating = "again" | "hard" | "easy";
export type TranslationStatus = "pending" | "ready" | "failed";
export type ShowFirst = "en" | "ru";

export type PhraseSource = {
  type: "manual" | "import" | "subtitle" | "ocr";
  url?: string;
  timestamp?: number;
};

export type PhraseCard = {
  id: string;
  lessonId: string;
  lessonTitle?: string;
  english: string;
  russian: string;
  alternativeTranslations: string[];
  transcription: string;
  exampleEn: string;
  exampleRu: string;
  difficulty: number;
  favorite: boolean;

  progress: number;
  known: boolean;
  stability: number;
  retrievability: number;

  reviewCount: number;
  successfulReviewCount: number;
  consecutiveCorrect: number;
  lapseCount: number;
  hintCount: number;
  lastRating: Rating | null;

  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
  lastReviewedAt: string | null;
  dueAt: string | null;

  translationStatus: TranslationStatus;
  source: PhraseSource;
};

export type Topic = {
  id: string;
  name: string;
  position: number;
  lessonCount?: number;
};

export type LessonStats = {
  total: number;
  due: number;
  learning: number;
  learned: number;
  progress: number; // 0..100 average
};

export type Lesson = {
  id: string;
  title: string;
  topicId: string | null;
  topicName: string | null;
  archived: boolean;
  lastOpenedAt: string | null;
  createdAt: string;
  stats: LessonStats;
};

export type RuleExercise = {
  id: string;
  ruleId: string;
  type: "choice" | "fill" | "fix" | "order" | "translate" | "identify";
  prompt: string;
  answers: string[];
  options: string[];
  explanation: string;
  position: number;
};

export type GrammarRule = {
  id: string;
  title: string;
  query: string;
  status: TranslationStatus;
  explanation: string;
  formula: string;
  uses: string[];
  examples: { en: string; ru: string }[];
  markers: string[];
  mistakes: string[];
  comparison: string;
  archived: boolean;
  progress: number;
  known: boolean;
  difficulty: number;
  reviewCount: number;
  consecutiveCorrect: number;
  dueAt: string | null;
  lastReviewedAt: string | null;
  createdAt: string;
  exercises: RuleExercise[];
};

export type HueTheme = "blue" | "green" | "purple" | "red";

export type UserSettings = {
  cardsPerDay: number;
  newCardsPerDay: number;
  showFirst: ShowFirst;
  voice: string;
  speechRate: number;
  autoPlay: boolean;
  requiredSuccess: number;
  requiredStreak: number;
  minIntervalDays: number;
  countHardAsCorrect: boolean;
  progressThreshold: number;
  animationsEnabled: boolean;
  refreshLearned: boolean;
  theme: HueTheme;
  lastSection: string;
  telegramLessonIds: string[];
};

export type TranslationResult = {
  sourceLanguage: "en" | "ru";
  english: string;
  translations: string[];
  transcription: string;
  difficulty: number;
  exampleEn: string;
  exampleRu: string;
};
