"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { KnowledgeDTO } from "@/lib/types";
import { Modal, Spinner, toast } from "./ui";

type Props = {
  initial?: KnowledgeDTO;
  onClose: () => void;
  onSaved?: (id: string) => void;
};

const IMPORTANCE = ["Низкая", "Средняя", "Высокая"];

// Ручное добавление / редактирование знания (§3.1, §15, §20).
export function KnowledgeEditor({ initial, onClose, onSaved }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [keyPoints, setKeyPoints] = useState<string[]>(initial?.keyPoints ?? []);
  const [topicPath, setTopicPath] = useState(initial?.topicPath ?? "");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [comment, setComment] = useState(initial?.personalComment ?? "");
  const [importance, setImportance] = useState(initial?.importance ?? 2);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [dupes, setDupes] = useState<{ id: string; title: string; similarity: number }[]>([]);

  const editing = !!initial;

  async function suggest() {
    if (!content.trim()) {
      toast("Сначала напишите текст");
      return;
    }
    setSuggesting(true);
    try {
      const m = await api.suggestMeta(title, content);
      if (!title.trim() && m.title) setTitle(m.title);
      if (!topicPath.trim() && m.topic) setTopicPath(m.topic);
      if (m.tags.length) setTags(m.tags.join(", "));
      toast("AI предложил метаданные");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setSuggesting(false);
    }
  }

  async function save(ignoreDupes = false) {
    if (!title.trim() && !content.trim()) {
      toast("Нужны название или текст");
      return;
    }
    setSaving(true);
    try {
      const tagArr = tags.split(",").map((t) => t.trim()).filter(Boolean);
      const kp = keyPoints.map((k) => k.trim()).filter(Boolean);
      if (!editing && !ignoreDupes) {
        const { candidates } = await api.checkDuplicate({ title, content });
        if (candidates.length) {
          setDupes(candidates);
          setSaving(false);
          return;
        }
      }
      if (editing) {
        await api.patchKnowledge(initial!.id, {
          title,
          content,
          keyPoints: kp,
          tags: tagArr,
          topicPath,
          personalComment: comment,
          importance,
        });
        toast("Сохранено");
        onSaved?.(initial!.id);
        router.refresh();
      } else {
        const { id } = await api.createKnowledge({
          title,
          content,
          keyPoints: kp,
          tags: tagArr,
          topicPath,
          personalComment: comment,
          importance,
        });
        toast("Знание сохранено");
        onSaved?.(id);
        router.refresh();
      }
      onClose();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} width={620}>
      <h2 className="modal-title">{editing ? "Редактировать знание" : "Новое знание"}</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>
        Вы сами решаете, что становится вашим знанием.
      </p>

      <div className="field">
        <label className="label">Название</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Короткое название" />
      </div>

      <div className="field">
        <label className="label">Текст</label>
        <textarea className="textarea" rows={5} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Суть знания своими словами…" />
      </div>

      <KeyPointsEditor value={keyPoints} onChange={setKeyPoints} />

      <div className="grid grid-2">
        <div className="field">
          <label className="label">Тема → Подтема</label>
          <input className="input" value={topicPath} onChange={(e) => setTopicPath(e.target.value)} placeholder="Маркетинг → Branding" />
        </div>
        <div className="field">
          <label className="label">Важность</label>
          <select className="select" value={importance} onChange={(e) => setImportance(Number(e.target.value))}>
            {IMPORTANCE.map((l, i) => (
              <option key={i} value={i + 1}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label className="label">Теги (через запятую)</label>
        <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="brand growth, memory" />
      </div>

      <div className="field">
        <label className="label">Мой комментарий</label>
        <textarea className="textarea" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Что для меня здесь важно…" />
      </div>

      {dupes.length > 0 && (
        <div className="card pad" style={{ borderColor: "var(--amber)", background: "var(--amber-soft)", marginBottom: 14 }}>
          <strong>Возможно, у вас уже есть похожее знание:</strong>
          <div className="stack" style={{ marginTop: 8, gap: 6 }}>
            {dupes.map((d) => (
              <a key={d.id} href={`/knowledge/${d.id}`} className="chip chip-amber" style={{ width: "fit-content" }}>
                {d.title} · {(d.similarity * 100).toFixed(0)}%
              </a>
            ))}
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn btn-sm" onClick={() => save(true)}>
              Всё равно сохранить отдельно
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setDupes([])}>
              Отмена
            </button>
          </div>
        </div>
      )}

      <div className="row spread" style={{ marginTop: 6 }}>
        <button className="btn btn-ghost" onClick={suggest} disabled={suggesting}>
          {suggesting ? <Spinner /> : "✨"} AI: тема, название, теги
        </button>
        <div className="row">
          <button className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
          <button className="btn btn-primary" onClick={() => save()} disabled={saving}>
            {saving ? <Spinner /> : null} Сохранить
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function KeyPointsEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div className="field">
      <label className="label">Ключевые тезисы</label>
      {value.length > 0 && (
        <ul className="kp-list" style={{ marginBottom: 8 }}>
          {value.map((kp, i) => (
            <li key={i} className="kp-item">
              <span>{kp}</span>
              <button className="del" onClick={() => onChange(value.filter((_, j) => j !== i))} title="Удалить">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="row">
        <input
          className="input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              onChange([...value, draft.trim()]);
              setDraft("");
            }
          }}
          placeholder="Добавить тезис и Enter"
        />
      </div>
    </div>
  );
}
