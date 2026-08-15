"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { A } from "@/lib/api";
import type { UserSettings } from "@/lib/types";
import { AppContext, SECTIONS, type SectionId, type StudyScope } from "./app-context";
import { TopNav } from "./TopNav";
import { ToastProvider } from "./ui";
import { TodaySection } from "./sections/TodaySection";
import { LessonsSection } from "./sections/LessonsSection";
import { PhrasesSection } from "./sections/PhrasesSection";
import { RulesSection } from "./sections/RulesSection";
import { ProgressSection } from "./sections/ProgressSection";
import { SettingsSection } from "./sections/SettingsSection";
import { StudySession } from "./study/StudySession";

const LS_KEY = "luma:section";

export function AppShell() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [section, setSection] = useState<SectionId>("today");
  const [refreshKey, setRefreshKey] = useState(0);
  const [study, setStudy] = useState<StudyScope | null>(null);
  const [ttsAvailable, setTtsAvailable] = useState(false);
  const ready = useRef(false);

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
      A.ttsInfo().then((t) => setTtsAvailable(t.available)).catch(() => {});
      ready.current = true;
    })();
  }, []);

  // Цветовая тема (data-hue) и настройка «анимации».
  useEffect(() => {
    if (!settings) return;
    document.documentElement.setAttribute("data-hue", settings.theme || "blue");
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
      <div className="app-outer" style={{ alignItems: "center", justifyContent: "center" }}>
        <div className="brand" style={{ fontSize: 34 }}>
          luma<span className="dim">.</span>
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
          ttsAvailable,
          studyOpen: !!study,
        }}
      >
        <div className="app-outer">
          <div className="app-frame">
            <div className="app-panel">
              <TopNav
                active={section}
                onNavigate={navigate}
                onStartSession={() => setStudy({ scope: "today" })}
              />
              {/* key=section перезапускает fade-up при смене раздела */}
              <div className="content-col stage" key={section}>
                {section === "today" && <TodaySection />}
                {section === "lessons" && <LessonsSection />}
                {section === "phrases" && <PhrasesSection />}
                {section === "rules" && <RulesSection />}
                {section === "progress" && <ProgressSection />}
                {section === "settings" && <SettingsSection />}
              </div>
            </div>
          </div>
        </div>

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
