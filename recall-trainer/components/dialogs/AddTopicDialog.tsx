"use client";
import { useState } from "react";
import { A } from "@/lib/api";
import { Modal, Spinner, useToast } from "../ui";
import type { Collection, Knowledge } from "@/lib/types";

export function AddTopicDialog({
  collections,
  defaultCollectionId,
  onClose,
  onCreated,
}: {
  collections: Collection[];
  defaultCollectionId?: string | null;
  onClose: () => void;
  onCreated: (k: Knowledge) => void;
}) {
  const toast = useToast();
  const [sourceText, setSourceText] = useState("");
  const [title, setTitle] = useState("");
  const [collectionId, setCollectionId] = useState<string>(defaultCollectionId ?? "");
  const [newCollection, setNewCollection] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!sourceText.trim()) {
      toast("Вставьте текст темы", "error");
      return;
    }
    setBusy(true);
    try {
      let colId = collectionId || null;
      if (collectionId === "__new" && newCollection.trim()) {
        const c = await A.createCollection(newCollection.trim());
        colId = c.id;
      }
      const k = await A.createKnowledge({
        sourceText: sourceText.trim(),
        title: title.trim() || undefined,
        collectionId: colId,
      });
      if (k.genStatus === "ready") toast("Тема добавлена, вопрос составлен", "success");
      else toast("Тема сохранена, но вопрос не сгенерирован — можно повторить", "info");
      onCreated(k);
    } catch (e) {
      toast((e as Error).message || "Не удалось сохранить", "error");
      setBusy(false);
    }
  };

  return (
    <Modal title="Новая тема" onClose={busy ? () => {} : onClose} wide>
      <label className="label">Текст темы (конспект)</label>
      <textarea
        className="textarea"
        style={{ minHeight: 200 }}
        placeholder="Вставьте сюда конспект, статью или свои заметки по теме. Recall составит по ним один вопрос для припоминания, а сам текст сохранит целиком."
        value={sourceText}
        onChange={(e) => setSourceText(e.target.value)}
        autoFocus
        disabled={busy}
      />

      <div style={{ marginTop: 14 }}>
        <label className="label">Название темы (необязательно — иначе придумает ИИ)</label>
        <input
          className="input"
          placeholder="Напр. «Жизненный цикл клетки»"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={busy}
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <label className="label">Раздел</label>
        <select
          className="select"
          value={collectionId}
          onChange={(e) => setCollectionId(e.target.value)}
          disabled={busy}
        >
          <option value="">Без раздела</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
          <option value="__new">+ Новый раздел…</option>
        </select>
        {collectionId === "__new" && (
          <input
            className="input"
            style={{ marginTop: 8 }}
            placeholder="Название раздела"
            value={newCollection}
            onChange={(e) => setNewCollection(e.target.value)}
            disabled={busy}
          />
        )}
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
        <button className="btn" onClick={onClose} disabled={busy}>Отмена</button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? (<><Spinner /> Составляю вопрос…</>) : "Добавить тему"}
        </button>
      </div>
    </Modal>
  );
}
