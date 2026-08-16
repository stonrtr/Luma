"use client";
import { useCallback, useEffect, useState } from "react";
import { A } from "@/lib/api";
import type { UserSettings } from "@/lib/types";
import { AppContext, SECTIONS, type SectionId, type StudyScope } from "./app-context";
import { TopNav } from "./TopNav";
import { ToastProvider } from "./ui";
import { TodaySection } from "./sections/TodaySection";
import { KnowledgeSection } from "./sections/KnowledgeSection";
import { ProgressSection } from "./sections/ProgressSection";
import { SettingsSection } from "./sections/SettingsSection";
import { StudySession } from "./study/StudySession";

const LS_KEY = "recall:section";

export function AppShell() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [section, setSection] = useState<SectionId>("today");
  const [refreshKey, setRefreshKey] = useState(0);
  const [study, setStudy] = useState<StudyScope | null>(null);

  useEffect(() => {
    (async () => {
      const s = await A.settings().catch(() => null);
      let initial: string | null = null;
      try {
        initial = localStorage.getItem(LS_KEY);
      } catch {}
      const wanted = initial || s?.lastSection || "today";
      if (SECTIONS.some((x) => x.id === wanted)) setSection(wanted as SectionId);
      if (s) setSettings(s);
    })();
  }, []);

  useEffect(() => {
    if (!settings) return;
    document.body.classList.toggle("no-anim", !settings.animationsEnabled);
  }, [settings]);

  const navigate = useCallback((id: SectionId) => {
    setSection(id);
    try {
      localStorage.setItem(LS_KEY, id);
    } catch {}
    A.saveSettings({ lastSection: id }).catch(() => {});
  }, []);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const updateSettings = useCallback((patch: Partial<UserSettings>) => {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
    A.saveSettings(patch).then((full) => setSettings(full)).catch(() => {});
  }, []);

  if (!settings) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <div className="brand" style={{ fontSize: 28 }}>
          <span className="dot" /> Recall
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <AppContext.Provider
        value={{
          settings,
          updateSettings,
          refreshKey,
          refresh,
          startStudy: setStudy,
          goTo: navigate,
        }}
      >
        <TopNav active={section} onNavigate={navigate} />
        <main className="container section-pad">
          {section === "today" && <TodaySection />}
          {section === "knowledge" && <KnowledgeSection />}
          {section === "progress" && <ProgressSection />}
          {section === "settings" && <SettingsSection />}
        </main>

        {study && (
          <StudySession
            scope={study}
            onClose={() => {
              setStudy(null);
              refresh();
            }}
          />
        )}
      </AppContext.Provider>
    </ToastProvider>
  );
}
