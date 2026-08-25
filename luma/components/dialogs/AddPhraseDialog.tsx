"use client";
import { useState } from "react";
import { A } from "@/lib/api";
import { detectLanguage } from "@/lib/lang";
import { estimateDifficulty } from "@/lib/difficulty";
import { Modal, Spinner, DifficultyDot, useToast } from "../ui";
import { LessonPicker } from "./LessonPicker";
import { resolveLessonId, targetValid, type LessonTarget } from "./lesson-target";

type Fields = {
  english: string;
  russian: string;
  transcription: string;
  exampleEn: string;
  exampleRu: string;
  difficulty: number;
  alts: string[];
  sourceLang: "en" | "ru";
};

export function AddPhraseDialog({
  presetLessonId,
  onClose,
  onAdded,
}: {
  presetLessonId?: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const toast = useToast();
  const [target, setTarget] = useState<LessonTarget>(
    presetLessonId ? { kind: "existing", lessonId: presetLessonId } : { kind: "existing", lessonId: "" }
  );
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<"input" | "review">("input");
  const [fields, setFields] = useState<Fields | null>(null);
  const [saving, setSaving] = useState(false);

  const startManual = () => {
    const lang = detectLanguage(text);
    setFields({
      english: lang === "en" ? text.trim() : "",
      russian: lang === "ru" ? text.trim() : "",
      transcription: "",
      exampleEn: "",
      exampleRu: "",
      difficulty: estimateDifficulty(lang === "en" ? text : ""),
      alts: [],
      sourceLang: lang,
    });
    setStage("review");
  };

  const translate = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await A.translatePreview({ text: text.trim() });
      if (res.error || !res.translations) {
        toast(res.message || "Автоперевод недоступен — введите перевод вручную", "info");
        startManual();
        return;
      }
      const src = res.sourceLanguage;
      setFields({
        english: src === "en" ? res.english || text.trim() : res.english,
        russian: src === "en" ? res.translations[0] || "" : text.trim(),
        transcription: res.transcription,
        exampleEn: res.exampleEn,
        exampleRu: res.exampleRu,
        difficulty: res.difficulty,
        alts: res.translations,
        sourceLang: src,
      });
      setStage("review");
    } catch (e) {
      toast((e as Error).message || "Перевод не удался", "error");
      startManual();
    } finally {
      setLoading(false);
    }
  };

  const pickTranslation = (t: string) => {
    if (!fields) return;
    // Choosing a translation fills the side opposite to the source language.
    if (fields.sourceLang === "en") setFields({ ...fields, russian: t });
    else setFields({ ...fields, english: t });
  };

  const save = async () => {
    if (!fields) return;
    if (!targetValid(target)) return toast("Выберите урок", "error");
    if (!fields.english && !fields.russian) return toast("Введите фразу и перевод", "error");
    setSaving(true);
    try {
      const lessonId = await resolveLessonId(target);
      const chosen = fields.sourceLang === "en" ? fields.russian : fields.english;
      await A.createPhrase({
        lessonId,
        english: fields.english,
        russian: fields.russian,
        alternativeTranslations: fields.alts.filter((a) => a !== chosen).slice(0, 4),
        transcription: fields.transcription,
        exampleEn: fields.exampleEn,
        exampleRu: fields.exampleRu,
        difficulty: fields.difficulty,
        source: { type: "manual" },
      });
      toast("Фраза добавлена", "success");
      onAdded();
      // reset for quick multi-add
      setText("");
      setFields(null);
      setStage("input");
    } catch (e) {
      toast((e as Error).message || "Не удалось сохранить", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Добавить фразу" onClose={onClose}>
      {!presetLessonId && (
        <div style={{ marginBottom: 16 }}>
          <LessonPicker value={target} onChange={setTarget} />
        </div>
      )}

      {stage === "input" && (
        <>
          <label className="label">Слово, выражение или фраза (EN или RU)</label>
          <input
            className="input"
            value={text}
            autoFocus
            placeholder="Напр. «a significant achievement» или «уложиться в срок»"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && translate()}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={translate} disabled={loading || !text.trim()}>
              {loading ? <Spinner /> : "Перевести"}
            </button>
            <button className="btn" onClick={startManual} disabled={!text.trim()}>
              Ввести вручную
            </button>
          </div>
        </>
      )}

      {stage === "review" && fields && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label className="label">English</label>
              <input className="input" value={fields.english} onChange={(e) => setFields({ ...fields, english: e.target.value })} />
            </div>
            <div>
              <label className="label">Перевод</label>
              <input className="input" value={fields.russian} onChange={(e) => setFields({ ...fields, russian: e.target.value })} />
            </div>
          </div>

          {fields.alts.length > 1 && (
            <div>
              <label className="label">Варианты перевода — выберите</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {fields.alts.map((t) => {
                  const chosen = fields.sourceLang === "en" ? fields.russian : fields.english;
                  return (
                    <button
                      key={t}
                      className={`btn btn-sm ${t === chosen ? "btn-primary" : ""}`}
                      onClick={() => pickTranslation(t)}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" }}>
            <div>
              <label className="label">Транскрипция</label>
              <input className="input" value={fields.transcription} onChange={(e) => setFields({ ...fields, transcription: e.target.value })} />
            </div>
            <div>
              <label className="label">Сложность</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <DifficultyDot d={fields.difficulty} />
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={10}
                  style={{ width: 72 }}
                  value={fields.difficulty}
                  onChange={(e) => setFields({ ...fields, difficulty: Math.max(1, Math.min(10, Number(e.target.value) || 5)) })}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="label">Пример (EN)</label>
            <input className="input" value={fields.exampleEn} onChange={(e) => setFields({ ...fields, exampleEn: e.target.value })} />
          </div>
          <div>
            <label className="label">Пример (RU)</label>
            <input className="input" value={fields.exampleRu} onChange={(e) => setFields({ ...fields, exampleRu: e.target.value })} />
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginTop: 6 }}>
            <button className="btn" onClick={() => setStage("input")}>← Назад</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? <Spinner /> : "Сохранить фразу"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
