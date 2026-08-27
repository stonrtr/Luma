"use client";
import { useEffect, useState } from "react";
import { A } from "@/lib/api";
import type { Lesson } from "@/lib/types";
import { speakEnglish } from "@/lib/tts-client";
import { useApp } from "../app-context";
import { Confirm, useToast } from "../ui";

export function SettingsSection() {
  const { settings, updateSettings, ttsAvailable } = useApp();
  const toast = useToast();
  const [voices, setVoices] = useState<{ id: string; label: string }[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [tgOpen, setTgOpen] = useState(false);

  useEffect(() => {
    A.lessons(false).then(setLessons).catch(() => {});
  }, []);

  const tgIds = settings.telegramLessonIds || [];
  const toggleTgLesson = (id: string) => {
    const next = tgIds.includes(id) ? tgIds.filter((x) => x !== id) : [...tgIds, id];
    updateSettings({ telegramLessonIds: next });
  };

  useEffect(() => {
    A.ttsInfo()
      .then((t) => {
        setVoices(t.voices);
        // Если сохранённый голос не из текущего провайдера — переключаем на первый доступный.
        if (t.voices.length > 0 && !t.voices.some((v) => v.id === settings.voice)) {
          updateSettings({ voice: t.voices[0].id });
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div>
        <div className="title-hero">
          настройки<span className="dim">.</span>
        </div>
      </div>

      <Group title="Обучение">
        <NumberRow label="Карточек в день" value={settings.cardsPerDay} min={1} max={500} onChange={(v) => updateSettings({ cardsPerDay: v })} />
        <NumberRow label="Новых карточек в день" value={settings.newCardsPerDay} min={0} max={200} onChange={(v) => updateSettings({ newCardsPerDay: v })} />
        <Row label="Показывать сначала">
          <div style={{ display: "flex", gap: 6 }}>
            <button className={`toggle-pill ${settings.showFirst === "en" ? "on" : ""}`} onClick={() => updateSettings({ showFirst: "en" })}>English</button>
            <button className={`toggle-pill ${settings.showFirst === "ru" ? "on" : ""}`} onClick={() => updateSettings({ showFirst: "ru" })}>Русский</button>
          </div>
        </Row>
        <ToggleRow label="Освежать выученные слова" checked={settings.refreshLearned} onChange={(v) => updateSettings({ refreshLearned: v })} />
        <p style={{ color: "var(--ink-3)", fontSize: 12, margin: 0, fontWeight: 600 }}>
          Подмешивает в «Сегодня» несколько выученных слов чуть раньше срока, чтобы память не проседала. Если ошибёшься —
          слово теряет статус «выучено» и возвращается в обычную очередь.
        </p>
      </Group>

      <Group title="Как считается прогресс слова">
        <p style={{ color: "var(--ink-body)", fontSize: 14, lineHeight: 1.7, margin: 0 }}>
          Чтобы слово стало «выучено», нужно набрать <b>100 баллов</b>:
        </p>
        <ul style={{ margin: 0, paddingLeft: 18, color: "var(--ink-body)", fontSize: 15, lineHeight: 1.8, display: "flex", flexDirection: "column", gap: 6 }}>
          <li><b>«Легко»</b> — +25 баллов</li>
          <li><b>«С трудом»</b> — +15 баллов</li>
          <li><b>«Не вспомнил» и подсказка</b> — сбрасывают баллы в 0</li>
        </ul>
        <p style={{ color: "var(--ink-2)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          Отдельно работает расписание — через сколько дней показать слово снова: «Легко» растягивает интервал сильнее
          «С трудом», а сложные слова повторяются чаще. Баллы и дни — разные вещи.
        </p>
      </Group>

      <Group title="Озвучка">
        <Row label="Голос">
          <select
            className="select"
            style={{ maxWidth: 260, minHeight: 42, fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            value={settings.voice}
            onChange={(e) => {
              const v = e.target.value;
              updateSettings({ voice: v });
              // Сразу проигрываем образец выбранным голосом.
              speakEnglish("This is a sample sentence.", v, settings.speechRate);
            }}
          >
            {voices.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
            {voices.length === 0 && <option value={settings.voice}>Системный голос браузера</option>}
          </select>
        </Row>
        <Row label="Скорость речи">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.1}
              value={settings.speechRate}
              onChange={(e) => updateSettings({ speechRate: Number(e.target.value) })}
              style={{ accentColor: "var(--accent)" }}
            />
            <span style={{ color: "var(--ink-2)", width: 36, fontWeight: 700 }}>{settings.speechRate.toFixed(1)}×</span>
          </div>
        </Row>
        <ToggleRow label="Автоозвучка после открытия карточки" checked={settings.autoPlay} onChange={(v) => updateSettings({ autoPlay: v })} />
        <Row label="Проверить голос">
          <button className="lbtn" style={{ minHeight: 38, fontSize: 14 }} onClick={() => speakEnglish("This is a sample sentence.", settings.voice, settings.speechRate)}>
            🔊 Тест
          </button>
        </Row>
        {!ttsAvailable && (
          <p style={{ color: "var(--ink-3)", fontSize: 12, margin: 0, fontWeight: 600 }}>
            Серверный TTS (Deepgram) не настроен — используется голос браузера.
          </p>
        )}
      </Group>

      <Group title="Импорт из Telegram">
        <p style={{ color: "var(--ink-2)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          Отметь уроки, в которые можно добавлять фразы из Telegram-бота. В боте будут
          показаны кнопки только этих уроков.
        </p>
        {lessons.length === 0 ? (
          <p style={{ color: "var(--ink-3)", fontSize: 12, margin: 0, fontWeight: 600 }}>Сначала создай хотя бы один урок.</p>
        ) : (
          <div>
            <button
              onClick={() => setTgOpen((v) => !v)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                width: "100%", padding: "10px 14px", cursor: "pointer",
                borderRadius: 12, border: "1.5px solid var(--glass-border-strong)",
                background: "transparent", color: "var(--ink-body)", fontWeight: 700, fontSize: 14,
              }}
            >
              <span>{tgIds.length > 0 ? `Выбрано уроков: ${tgIds.length}` : "Выбрать уроки"}</span>
              <span style={{ transform: tgOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s", opacity: 0.6 }}>▾</span>
            </button>
            {tgOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 8, maxHeight: 260, overflowY: "auto" }}>
                {lessons.map((l) => {
                  const on = tgIds.includes(l.id);
                  return (
                    <div
                      key={l.id}
                      onClick={() => toggleTgLesson(l.id)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 6px", cursor: "pointer", borderRadius: 8 }}
                    >
                      <span
                        style={{
                          width: 20, height: 20, flex: "none", borderRadius: 6,
                          border: on ? "none" : "1.5px solid var(--glass-border-strong)",
                          background: on ? "var(--accent)" : "transparent",
                          color: "#fff", fontWeight: 900, fontSize: 13,
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        {on ? "✓" : ""}
                      </span>
                      <span style={{ fontWeight: 600, color: "var(--ink-body)" }}>{l.title}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Group>

      <Group title="Оформление">
        <ToggleRow label="Включить анимации" checked={settings.animationsEnabled} onChange={(v) => updateSettings({ animationsEnabled: v })} />
      </Group>

      <Group title="Данные">
        <Row label="Сбросить локальные настройки">
          <button
            className="lbtn lbtn-danger"
            style={{ minHeight: 38, fontSize: 14 }}
            onClick={() => setConfirmReset(true)}
          >
            Сбросить
          </button>
        </Row>
        <p style={{ color: "var(--ink-3)", fontSize: 12, margin: 0, fontWeight: 600 }}>
          Синхронизация аккаунта появится позже — сейчас данные хранятся локально на сервере приложения.
        </p>
      </Group>

      {confirmReset && (
        <Confirm
          message="Сбросить локальные настройки этого браузера? Уроки и фразы не затрагиваются."
          confirmLabel="Сбросить"
          onConfirm={() => {
            setConfirmReset(false);
            try {
              Object.keys(localStorage).filter((k) => k.startsWith("luma:")).forEach((k) => localStorage.removeItem(k));
            } catch {}
            toast("Локальные настройки сброшены", "success");
          }}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="wcard" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="overline-sm">{title}</div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <span style={{ fontWeight: 500, color: "var(--ink-body)" }}>{label}</span>
      {children}
    </div>
  );
}

function NumberRow({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <Row label={label}>
      <input
        className="input-num"
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
      />
    </Row>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row label={label}>
      <button className={`toggle-pill ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}>
        {checked ? "Вкл" : "Выкл"}
      </button>
    </Row>
  );
}
