export type UUID = string;

export interface Term {
  id: UUID;
  term: string;
  definition: string;
  termImage?: string; // data-url or remote url
  starred?: boolean;
  termLang?: string; // BCP-47 for TTS
  defLang?: string;
}

export type Visibility = "public" | "password" | "private";

export interface StudySet {
  id: UUID;
  title: string;
  description: string;
  terms: Term[];
  authorId: UUID;
  authorName: string;
  createdAt: number;
  updatedAt: number;
  folderIds: UUID[];
  visibility: Visibility;
  subject?: string;
  termLang: string;
  defLang: string;
}

export interface Folder {
  id: UUID;
  name: string;
  description?: string;
  setIds: UUID[];
  createdAt: number;
}

export interface ClassGroup {
  id: UUID;
  name: string;
  school?: string;
  setIds: UUID[];
  memberCount: number;
  createdAt: number;
}

export interface User {
  id: UUID;
  username: string;
  name: string;
  avatarColor: string;
  isPlus: boolean;
  streak: number;
}

/** Learn-mode per-term memory (Leitner-style boxes 0..2 -> not started/familiar/mastered) */
export interface LearnProgress {
  [termId: string]: {
    box: number; // 0 = still learning, 1 = familiar, 2 = mastered
    seen: number;
    correct: number;
    lastRound: number;
  };
}

export interface SetStats {
  learn: LearnProgress;
  testBest?: number;
  matchBest?: number; // best time in ms
  gravityBest?: number; // best score
  lastStudied?: number;
  roundsPlayed?: number;
}

export interface AppData {
  user: User;
  sets: StudySet[];
  folders: Folder[];
  classes: ClassGroup[];
  stats: Record<string, SetStats>;
  recentSetIds: UUID[];
  settings: {
    dark: boolean;
    soundOn: boolean;
    autoplayFlashcards: boolean;
  };
}
