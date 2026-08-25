"use client";
import { useMemo, useState } from "react";
import { A } from "@/lib/api";
import { parseImport } from "@/lib/importParser";
import { Modal, Spinner, useToast } from "../ui";
import { LessonPicker } from "./LessonPicker";
import { importPayload, targetValid, type LessonTarget } from "./lesson-target";

type ImportResult = { lessonId: string; saved: number; translated: number; pending: number; errors: number };

export function ImportDialog({
  presetLessonId,
  onClose,
  onImported,
}: {
  presetLessonId?: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const toast = useToast();
  const [target, setTarget] = useState<LessonTarget>(
    presetLessonId ? { kind: "existing", lessonId: presetLessonId } : { kind: "existing", lessonId: "" }
  );
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [retrying, setRetrying] = useState(false);

  const parsedCount = useMemo(() => parseImport(text).entries.length, [text]);

  const run = async () => {
    if (!targetValid(target)) return toast("Выберите урок", "error");
    if (!text.trim()) return toast("Вставьте список фраз", "error");
    setLoading(true);
    try {
      const res = await A.import({ ...importPayload(target), text });
      setResult(res);
      onImported();
    } catch (e) {
      toast((e as Error).message || "Ошибка импорта", "error");
    } finally {
      setLoading(false);
    }
  };

  const retry = async () => {
    setRetrying(true);
    try {
      const { translated } = await A.runTranslations();
      toast(`Переведено: ${translated}`, "success");
      onImported();
      if (result) setResult({ ...result, translated: result.translated + translated, pending: Math.max(0, result.pending - translated) });
    } catch (e) {
      toast((e as Error).message || "Не удалось", "error");
    } finally {
      setRetrying(false);
    }
  };

  return (
    <Modal title="Импорт фраз" onClose={onClose} wide>
      {!result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!presetLessonId && <LessonPicker value={target} onChange={setTarget} />}

          <div>
            <label className="label">Список — одна фраза на строку</label>
            <textarea
              className="textarea"
              value={text}
              placeholder={"significant achievement — значительное достижение\nto meet a deadline; уложиться в срок\nby the way\nуложиться в срок"}
              onChange={(e) => setText(e.target.value)}
              style={{ minHeight: 150, fontFamily: "monospace", fontSize: 14 }}
            />
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Разделители: тире «—», точка с запятой «;» или табуляция. Запятая не используется как разделитель.
              Распознано строк: <b>{parsedCount}</b>
            </div>
          </div>

          {/* Прилипающий футер: кнопка всегда видна, даже если список длинный */}
          <div
            style={{
              position: "sticky",
              bottom: 0,
              display: "flex",
              justifyContent: "flex-end",
              margin: "0 -20px -20px",
              padding: "14px 20px",
              background: "rgba(7,34,116,0.96)",
              borderTop: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <button className="btn btn-primary" onClick={run} disabled={loading || parsedCount === 0}>
              {loading ? <Spinner /> : `Импортировать (${parsedCount})`}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Stat label="Сохранено" value={result.saved} tone="primary" />
            <Stat label="Переведено" value={result.translated} tone="success" />
            <Stat label="Ожидают перевода" value={result.pending} tone="muted" />
            <Stat label="Ошибки" value={result.errors} tone={result.errors ? "danger" : "muted"} />
          </div>
          {result.pending > 0 && (
            <div className="card" style={{ padding: 14 }}>
              <p className="muted" style={{ marginTop: 0 }}>
                Переводы загружаются в фоне. Фразы без перевода временно не участвуют в очереди обучения.
              </p>
              <button className="btn btn-sm" onClick={retry} disabled={retrying}>
                {retrying ? <Spinner /> : "Обновить переводы сейчас"}
              </button>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              className="btn"
              onClick={() => {
                setResult(null);
                setText("");
              }}
            >
              Импортировать ещё
            </button>
            <button className="btn btn-primary" onClick={onClose}>
              Готово
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "primary" | "success" | "muted" | "danger" }) {
  const color =
    tone === "primary" ? "var(--primary)" : tone === "success" ? "var(--success)" : tone === "danger" ? "var(--danger)" : "var(--muted)";
  return (
    <div className="card" style={{ padding: "12px 16px" }}>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
      <div className="muted" style={{ fontSize: 13 }}>{label}</div>
    </div>
  );
}
