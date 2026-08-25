"use client";
import { useState } from "react";
import { A } from "@/lib/api";
import type { PhraseCard } from "@/lib/types";
import { Modal, Spinner, DifficultyDot, useToast } from "../ui";

export function EditPhraseDialog({
  phrase,
  onClose,
  onSaved,
}: {
  phrase: PhraseCard;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [f, setF] = useState({
    english: phrase.english,
    russian: phrase.russian,
    transcription: phrase.transcription,
    exampleEn: phrase.exampleEn,
    exampleRu: phrase.exampleRu,
    difficulty: phrase.difficulty,
    alts: phrase.alternativeTranslations.join(", "),
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await A.updatePhrase(phrase.id, {
        english: f.english,
        russian: f.russian,
        transcription: f.transcription,
        exampleEn: f.exampleEn,
        exampleRu: f.exampleRu,
        difficulty: f.difficulty,
        alternativeTranslations: f.alts.split(",").map((s) => s.trim()).filter(Boolean),
      });
      toast("Сохранено", "success");
      onSaved();
      onClose();
    } catch (e) {
      toast((e as Error).message || "Ошибка", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Редактировать фразу" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label className="label">English</label>
            <input className="input" value={f.english} onChange={(e) => setF({ ...f, english: e.target.value })} />
          </div>
          <div>
            <label className="label">Перевод</label>
            <input className="input" value={f.russian} onChange={(e) => setF({ ...f, russian: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">Другие варианты перевода (через запятую)</label>
          <input className="input" value={f.alts} onChange={(e) => setF({ ...f, alts: e.target.value })} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" }}>
          <div>
            <label className="label">Транскрипция</label>
            <input className="input" value={f.transcription} onChange={(e) => setF({ ...f, transcription: e.target.value })} />
          </div>
          <div>
            <label className="label">Сложность</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <DifficultyDot d={f.difficulty} />
              <input
                className="input"
                type="number"
                min={1}
                max={10}
                style={{ width: 72 }}
                value={f.difficulty}
                onChange={(e) => setF({ ...f, difficulty: Math.max(1, Math.min(10, Number(e.target.value) || 5)) })}
              />
            </div>
          </div>
        </div>
        <div>
          <label className="label">Пример (EN)</label>
          <input className="input" value={f.exampleEn} onChange={(e) => setF({ ...f, exampleEn: e.target.value })} />
        </div>
        <div>
          <label className="label">Пример (RU)</label>
          <input className="input" value={f.exampleRu} onChange={(e) => setF({ ...f, exampleRu: e.target.value })} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? <Spinner /> : "Сохранить"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
