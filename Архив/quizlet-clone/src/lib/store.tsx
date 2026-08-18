"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  AppData,
  Folder,
  LearnProgress,
  SetStats,
  StudySet,
  Term,
} from "./types";
import { buildSeed, uid } from "./seed";

const KEY = "quizlet-clone:v1";

function load(): AppData {
  if (typeof window === "undefined") return buildSeed();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const seed = buildSeed();
      localStorage.setItem(KEY, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(raw) as AppData;
  } catch {
    return buildSeed();
  }
}

interface Ctx {
  data: AppData;
  ready: boolean;
  /* sets */
  getSet: (id: string) => StudySet | undefined;
  createSet: (s: Partial<StudySet> & { title: string; terms: Term[] }) => string;
  updateSet: (id: string, patch: Partial<StudySet>) => void;
  deleteSet: (id: string) => void;
  toggleStar: (setId: string, termId: string) => void;
  touchRecent: (setId: string) => void;
  /* folders */
  createFolder: (name: string, description?: string) => string;
  addSetToFolder: (folderId: string, setId: string) => void;
  removeSetFromFolder: (folderId: string, setId: string) => void;
  /* stats */
  statsFor: (setId: string) => SetStats;
  saveLearn: (setId: string, learn: LearnProgress, round: number) => void;
  recordScore: (
    setId: string,
    kind: "testBest" | "gravityBest",
    value: number
  ) => void;
  recordMatch: (setId: string, ms: number) => void;
  resetProgress: (setId: string) => void;
  /* settings */
  setDark: (v: boolean) => void;
  setSetting: (k: "soundOn" | "autoplayFlashcards", v: boolean) => void;
}

const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(buildSeed);
  const [ready, setReady] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    setData(load());
    setReady(true);
  }, []);

  // persist
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* quota */
    }
  }, [data]);

  // apply dark class
  useEffect(() => {
    const root = document.documentElement;
    if (data.settings.dark) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [data.settings.dark]);

  const api = useMemo<Ctx>(() => {
    const mutate = (fn: (d: AppData) => AppData) => setData((d) => fn(structuredClone(d)));

    return {
      data,
      ready,
      getSet: (id) => data.sets.find((s) => s.id === id),
      createSet: (s) => {
        const id = uid();
        const full: StudySet = {
          id,
          title: s.title,
          description: s.description ?? "",
          terms: s.terms,
          authorId: data.user.id,
          authorName: data.user.name,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          folderIds: s.folderIds ?? [],
          visibility: s.visibility ?? "public",
          subject: s.subject,
          termLang: s.termLang ?? "en",
          defLang: s.defLang ?? "en",
        };
        mutate((d) => {
          d.sets.unshift(full);
          d.recentSetIds = [id, ...d.recentSetIds.filter((x) => x !== id)].slice(0, 12);
          return d;
        });
        return id;
      },
      updateSet: (id, patch) =>
        mutate((d) => {
          const i = d.sets.findIndex((x) => x.id === id);
          if (i >= 0) d.sets[i] = { ...d.sets[i], ...patch, updatedAt: Date.now() };
          return d;
        }),
      deleteSet: (id) =>
        mutate((d) => {
          d.sets = d.sets.filter((s) => s.id !== id);
          d.recentSetIds = d.recentSetIds.filter((x) => x !== id);
          d.folders.forEach((f) => (f.setIds = f.setIds.filter((x) => x !== id)));
          delete d.stats[id];
          return d;
        }),
      toggleStar: (setId, termId) =>
        mutate((d) => {
          const s = d.sets.find((x) => x.id === setId);
          const t = s?.terms.find((x) => x.id === termId);
          if (t) t.starred = !t.starred;
          return d;
        }),
      touchRecent: (setId) =>
        mutate((d) => {
          d.recentSetIds = [setId, ...d.recentSetIds.filter((x) => x !== setId)].slice(0, 12);
          if (!d.stats[setId]) d.stats[setId] = { learn: {} };
          d.stats[setId].lastStudied = Date.now();
          return d;
        }),
      createFolder: (name, description) => {
        const id = uid();
        const f: Folder = { id, name, description, setIds: [], createdAt: Date.now() };
        mutate((d) => {
          d.folders.unshift(f);
          return d;
        });
        return id;
      },
      addSetToFolder: (folderId, setId) =>
        mutate((d) => {
          const f = d.folders.find((x) => x.id === folderId);
          if (f && !f.setIds.includes(setId)) f.setIds.push(setId);
          return d;
        }),
      removeSetFromFolder: (folderId, setId) =>
        mutate((d) => {
          const f = d.folders.find((x) => x.id === folderId);
          if (f) f.setIds = f.setIds.filter((x) => x !== setId);
          return d;
        }),
      statsFor: (setId) => data.stats[setId] ?? { learn: {} },
      saveLearn: (setId, learn, round) =>
        mutate((d) => {
          if (!d.stats[setId]) d.stats[setId] = { learn: {} };
          d.stats[setId].learn = learn;
          d.stats[setId].roundsPlayed = round;
          d.stats[setId].lastStudied = Date.now();
          return d;
        }),
      recordScore: (setId, kind, value) =>
        mutate((d) => {
          if (!d.stats[setId]) d.stats[setId] = { learn: {} };
          const cur = d.stats[setId][kind];
          if (cur === undefined || value > cur) d.stats[setId][kind] = value;
          return d;
        }),
      recordMatch: (setId, ms) =>
        mutate((d) => {
          if (!d.stats[setId]) d.stats[setId] = { learn: {} };
          const cur = d.stats[setId].matchBest;
          if (cur === undefined || ms < cur) d.stats[setId].matchBest = ms;
          return d;
        }),
      resetProgress: (setId) =>
        mutate((d) => {
          d.stats[setId] = { learn: {} };
          return d;
        }),
      setDark: (v) =>
        mutate((d) => {
          d.settings.dark = v;
          return d;
        }),
      setSetting: (k, v) =>
        mutate((d) => {
          d.settings[k] = v;
          return d;
        }),
    };
  }, [data, ready]);

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
