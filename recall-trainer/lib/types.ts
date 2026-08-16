// Shared domain types. These are the *serialized* shapes the API returns to the
// client — JSON-string columns are already parsed into arrays/objects.

export type Rating = "again" | "hard" | "easy";
export type GenStatus = "pending" | "ready" | "failed";

export type Collection = {
  id: string;
  name: string;
  position: number;
  topicCount?: number;
};

export type Knowledge = {
  id: string;
  title: string;
  sourceText: string;
  question: string;
  keyPoints: string[];
  collectionId: string | null;
  collectionName: string | null;
  archived: boolean;

  genStatus: GenStatus;
  genError: string;

  progress: number;
  known: boolean;
  stability: number;
  retrievability: number;
  difficulty: number;
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
};

export type UserSettings = {
  newCardsPerDay: number;
  cardsPerDay: number;
  requiredSuccess: number;
  requiredStreak: number;
  minIntervalDays: number;
  countHardAsCorrect: boolean;
  progressThreshold: number;
  animationsEnabled: boolean;
  lastSection: string;
};

// The shape the LLM returns for a pasted note.
export type GeneratedCard = {
  title: string;
  question: string;
  keyPoints: string[];
};

export type ProgressData = {
  totalTopics: number;
  learnedTotal: number;
  learningTotal: number;
  dueNow: number;
  reviewedToday: number;
  newToday: number;
  learnedToday: number;
  learnedWeek: number;
  distribution: number[]; // 5 buckets: 0-20,20-40,...80-100
  activity7: { date: string; reviewed: number; newStudied: number }[];
  streak: number;
};
