// Сериализованные доменные типы — то, что API отдаёт клиенту (JSON-поля уже
// распарсены в массивы/объекты).

export type Rating = "again" | "hard" | "easy";

export type SourceType =
  | "YOUTUBE"
  | "TEXT"
  | "ARTICLE"
  | "PDF"
  | "SITE"
  | "PODCAST"
  | "COURSE"
  | "THOUGHT"
  | "OTHER";

export type SourceStatus =
  | "NEW"
  | "TRANSCRIBING"
  | "ANALYZING"
  | "DRAFT_READY"
  | "EDITING"
  | "COMPLETED"
  | "ERROR";

export const SOURCE_STATUS_LABEL: Record<SourceStatus, string> = {
  NEW: "Добавлено",
  TRANSCRIBING: "Транскрибируется",
  ANALYZING: "AI анализирует",
  DRAFT_READY: "Черновик готов",
  EDITING: "Редактируется",
  COMPLETED: "Готово",
  ERROR: "Ошибка",
};

export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  YOUTUBE: "YouTube",
  TEXT: "Текст",
  ARTICLE: "Статья",
  PDF: "PDF",
  SITE: "Сайт",
  PODCAST: "Подкаст",
  COURSE: "Курс",
  THOUGHT: "Своя мысль",
  OTHER: "Другое",
};

export type TranscriptSegment = { start: number; end: number; text: string };

export type SourceDTO = {
  id: string;
  type: SourceType;
  title: string;
  author: string | null;
  url: string | null;
  thumbnail: string | null;
  duration: number | null;
  publishedAt: string | null;
  language: string;
  status: SourceStatus;
  error: string | null;
  hasRaw: boolean;
  segments: TranscriptSegment[];
  rawContent: string | null;
  createdAt: string;
  updatedAt: string;
  draftId: string | null;
  knowledgeCount: number;
};

export type DraftBlockDTO = {
  id: string;
  title: string;
  summary: string;
  content: string;
  keyPoints: string[];
  terms: string[];
  examples: string[];
  takeaways: string[];
  startTimestamp: number | null;
  endTimestamp: number | null;
  selected: boolean;
  order: number;
  topicId: string | null;
  suggestedTopic: string | null;
  userEdited: boolean;
};

export type DraftDTO = {
  id: string;
  sourceId: string;
  status: string;
  source: SourceDTO;
  blocks: DraftBlockDTO[];
};

export type KnowledgeDTO = {
  id: string;
  title: string;
  content: string;
  keyPoints: string[];
  topicId: string | null;
  topicPath: string | null;
  sourceId: string | null;
  sourceTitle: string | null;
  sourceType: SourceType | null;
  sourceUrl: string | null;
  sourceStart: number | null;
  sourceEnd: number | null;
  tags: string[];
  personalComment: string;
  importance: number;
  favorite: boolean;
  hasCard: boolean;
  cardDue: string | null;
  createdAt: string;
  updatedAt: string;
  lastReviewedAt: string | null;
  related?: { id: string; title: string }[];
};

export type TopicDTO = {
  id: string;
  name: string;
  parentId: string | null;
  position: number;
  knowledgeCount: number;
  children?: TopicDTO[];
};

export type CardDTO = {
  id: string;
  knowledgeId: string;
  knowledgeTitle: string;
  question: string;
  answer: string;
  progress: number;
  dueAt: string | null;
};

export type SearchHit = {
  id: string;
  title: string;
  snippet: string;
  topicPath: string | null;
  sourceTitle: string | null;
  score: number;
  kind: "semantic" | "keyword";
};
