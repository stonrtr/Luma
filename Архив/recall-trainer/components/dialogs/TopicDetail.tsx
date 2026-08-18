"use client";
import { useState } from "react";
import { A } from "@/lib/api";
import { Modal, Spinner, Confirm, useToast, ProgressBar, daysAgo } from "../ui";
import { useApp } from "../app-context";
import type { Collection, Knowledge } from "@/lib/types";

export function TopicDetail({
  topic,
  collections,
  onClose,
  onChanged,
  onDeleted,
}: {
  topic: Knowledge;
  collections: Collection[];
  onClose: () => void;
  onChanged: (k: Knowledge) => void;
  onDeleted: (id: string) => void;
}) {
  const toast = useToast();
  const { startStudy } = useApp();
  const [k, setK] = useState<Knowledge>(topic);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  // editable fields
  const [title, setTitle] = useState(k.title);
  const [question, setQuestion] = useState(k.question);
  const [keyPoints, setKeyPoints] = useState(k.keyPoints.join("\n"));
  const [sourceText, setSourceText] = useState(k.sourceText);
  const [collectionId, setCollectionId] = useState(k.collectionId ?? "");

  const saveEdits = async () => {
    setBusy(true);
    try {
      const updated = await A.updateKnowledge(k.id, {
        title: title.trim(),
        question: question.trim(),
        keyPoints: keyPoints.split("\n").map((s) => s.trim()).filter(Boolean),
        sourceText,
        collectionId: collectionId || null,
      });
      setK(updated);
      onChanged(updated);
      setEditing(false);
      toast("Сохранено", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async () => {
    setBusy(true);
    try {
      const updated = await A.regenerate(k.id);
      setK(updated);
      setTitle(updated.title);
      setQuestion(updated.question);
      setKeyPoints(updated.keyPoints.join("\n"));
      onChanged(updated);
      if (updated.genStatus === "ready") toast("Вопрос пересоставлен", "success");
      else toast(updated.genError || "Не удалось сгенерировать", "error");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    try {
      await A.deleteKnowledge(k.id);
      onDeleted(k.id);
      toast("Тема удалена", "info");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <Modal title={editing ? "Редактирование темы" : k.title} onClose={busy ? () => {} : onClose} wide>
      {editing ? (
        <>
          <label className="label">Название</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} />

          <label className="label" style={{ marginTop: 14 }}>Вопрос для припоминания</label>
          <textarea className="textarea" style={{ minHeight: 70 }} value={question} onChange={(e) => setQuestion(e.target.value)} disabled={busy} />

          <label className="label" style={{ marginTop: 14 }}>Ключевые пункты (по одному на строку)</label>
          <textarea className="textarea" style={{ minHeight: 120 }} value={keyPoints} onChange={(e) => setKeyPoints(e.target.value)} disabled={busy} />

          <label className="label" style={{ marginTop: 14 }}>Конспект</label>
          <textarea className="textarea" style={{ minHeight: 160 }} value={sourceText} onChange={(e) => setSourceText(e.target.value)} disabled={busy} />

          <label className="label" style={{ marginTop: 14 }}>Раздел</label>
          <select className="select" value={collectionId} onChange={(e) => setCollectionId(e.target.value)} disabled={busy}>
            <option value="">Без раздела</option>
            {collections.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>

          <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginTop: 20, flexWrap: "wrap" }}>
            <button className="btn" onClick={regenerate} disabled={busy}>
              {busy ? <Spinner /> : "↻"} Пересоставить вопрос ИИ
            </button>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn" onClick={() => setEditing(false)} disabled={busy}>Отмена</button>
              <button className="btn btn-primary" onClick={saveEdits} disabled={busy}>Сохранить</button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {k.collectionName && <span className="pill pill-muted">{k.collectionName}</span>}
            <span className={`pill ${k.known ? "pill-success" : ""}`}>{k.known ? "Выучено" : `Прогресс ${k.progress}%`}</span>
            {k.genStatus === "failed" && <span className="pill" style={{ background: "color-mix(in srgb, var(--danger) 14%, transparent)", color: "var(--danger)" }}>Вопрос не сгенерирован</span>}
          </div>

          <div style={{ marginBottom: 6 }}><ProgressBar value={k.progress} known={k.known} /></div>
          <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            Повторений: {k.reviewCount} · Последнее: {daysAgo(k.lastReviewedAt)}
          </p>

          <Block label="Вопрос">
            <p style={{ margin: 0, fontWeight: 600, fontSize: 17 }}>{k.question || "—"}</p>
          </Block>

          {k.keyPoints.length > 0 && (
            <Block label="Ключевые пункты">
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
                {k.keyPoints.map((p, i) => (<li key={i}>{p}</li>))}
              </ul>
            </Block>
          )}

          <Block label="Конспект">
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, maxHeight: 280, overflowY: "auto", fontSize: 15 }}>
              {k.sourceText}
            </div>
          </Block>

          {k.genStatus === "failed" && k.genError && (
            <p className="muted" style={{ fontSize: 12 }}>Причина: {k.genError}</p>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginTop: 20, flexWrap: "wrap" }}>
            <button className="btn btn-danger btn-sm" onClick={() => setConfirmDel(true)}>Удалить</button>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn" onClick={() => setEditing(true)}>Редактировать</button>
              <button
                className="btn btn-primary"
                onClick={() => { onClose(); startStudy({ scope: "all", cards: [k], title: k.title }); }}
              >
                Повторить сейчас
              </button>
            </div>
          </div>
        </>
      )}

      {confirmDel && (
        <Confirm
          message={`Удалить тему «${k.title}»? Это действие необратимо.`}
          onConfirm={del}
          onCancel={() => setConfirmDel(false)}
        />
      )}
    </Modal>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div className="label" style={{ marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
