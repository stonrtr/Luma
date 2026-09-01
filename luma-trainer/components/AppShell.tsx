"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { A } from "@/lib/api";
import type { UserSettings } from "@/lib/types";
import { AppContext, SECTIONS, type SectionId, type StudyScope } from "./app-context";
import { TopNav } from "./TopNav";
import { MobileNav } from "./MobileNav";
import { ToastProvider } from "./ui";
import { TodaySection } from "./sections/TodaySection";
import { LessonsSection } from "./sections/LessonsSection";
import { PhrasesSection } from "./sections/PhrasesSection";
import { ListenSection } from "./sections/ListenSection";
import { ProgressSection } from "./sections/ProgressSection";
import { SettingsSection } from "./sections/SettingsSection";
import { StudySession } from "./study/StudySession";
import { primeSfx } from "@/lib/sfx";

const LS_KEY = "luma:section";

export function AppShell() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [section, setSection] = useState<SectionId>("today");
  const [refreshKey, setRefreshKey] = useState(0);
  const [study, setStudy] = useState<StudyScope | null>(null);
  const [ttsAvailable, setTtsAvailable] = useState(false);
  const ready = useRef(false);

  useEffect(() => {
    primeSfx();
    // Свежий запуск PWA → «Сегодня». Но перезагрузка/перемонтаж В ТОЙ ЖЕ сессии
    // (например iOS перерисовал WebView) не должны выкидывать из раздела —
    // восстанавливаем последний раздел из sessionStorage (живёт до закрытия PWA).
    try {
      if (sessionStorage.getItem("luma:alive")) {
        const s = sessionStorage.getItem("luma:section");
        if (s && SECTIONS.some((x) => x.id === s)) setSection(s as SectionId);
      } else {
        sessionStorage.setItem("luma:alive", "1");
      }
    } catch {}
    (async () => {
      const s = await A.settings().catch(() => null);
      if (s) setSettings(s);
      A.ttsInfo().then((t) => setTtsAvailable(t.available)).catch(() => {});
      ready.current = true;
    })();
  }, []);

  // Держим текущий раздел в sessionStorage (для восстановления при перемонтаже).
  useEffect(() => {
    try {
      sessionStorage.setItem("luma:section", section);
    } catch {}
  }, [section]);

  // Настройка «анимации» (одна цветовая тема — переключателя нет).
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

  // Шестерёнка-переключатель: открыть настройки, повторный клик — вернуться назад.
  const prevSectionRef = useRef<SectionId>("today");
  const toggleSettings = useCallback(() => {
    setSection((cur) => {
      const target: SectionId = cur === "settings" ? (prevSectionRef.current === "settings" ? "today" : prevSectionRef.current) : "settings";
      if (cur !== "settings") prevSectionRef.current = cur;
      try {
        localStorage.setItem(LS_KEY, target);
      } catch {}
      A.saveSettings({ lastSection: target }).catch(() => {});
      return target;
    });
  }, []);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const updateSettings = useCallback((patch: Partial<UserSettings>) => {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
    A.saveSettings(patch).then((full) => setSettings(full)).catch(() => {});
  }, []);

  if (!settings) {
    return (
      <div className="app-outer" style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="Luma" width={54} height={54} style={{ borderRadius: 15, boxShadow: "0 8px 20px rgba(2,20,90,0.3)" }} />
          <div className="brand" style={{ fontSize: 34 }}>
            luma<span className="dim">.</span>
          </div>
        </div>
      </div>
    );
  }

  const inStudy = !!study;

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
        {/* Полноэкранный градиент без рамки. Скрываем оболочку, пока открыт
            полноэкранный оверлей сессии, чтобы не было двойного фона. */}
        {!inStudy && (
          <div className="app-outer">
            <TopNav
              active={section}
              onNavigate={navigate}
              onToggleSettings={toggleSettings}
              onStartRandom={() => setStudy({ scope: "random" })}
            />
            {/* key=section перезапускает fade-up при смене раздела */}
            <div className="content-col stage" key={section}>
              {section === "today" && <TodaySection />}
              {section === "lessons" && <LessonsSection />}
              {section === "phrases" && <PhrasesSection />}
              {section === "listen" && <ListenSection />}
              {section === "progress" && <ProgressSection />}
              {section === "settings" && <SettingsSection />}
            </div>
            <MobileNav active={section} onNavigate={navigate} />
          </div>
        )}

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
