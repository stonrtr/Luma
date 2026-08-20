"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { DraftBlockDTO, DraftDTO } from "@/lib/types";
import { fmtTimecode } from "@/lib/format";
import { Spinner, toast } from "./ui";

const QUICK_ACTIONS: { key: string; label: string }[] = [
  { key: "shorten", label: "Сделать короче" },
  { key: "expand", label: "Раскрыть подробнее" },
  { key: "simplify", label: "Объяснить проще" },
  { key: "restructure", label: "Структурировать" },
  { key: "highlight", label: "Выделить главное" },
  { key: "bulletize", label: "Список тезисов" },
];

export function DraftEditor({ draft: initial }: { draft: DraftDTO }) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<DraftBlockDTO[]>(initial.blocks);
  const [publishing, setPublishing] = useState(false);
  const source = initial.source;
  const selectedCount = blocks.filter((b) => b.selected).length;
  const hasTimecodes = source.type === "YOUTUBE";

  async function reload() {
    try {
      const d = await api.getDraft(initial.id);
      setBlocks(d.blocks);
    } catch (e) {
      toast((e as Error).message);
    }
  }

  function patchLocal(id: string, patch: Partial<DraftBlockDTO>) {
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  async function publish() {
    if (!selectedCount) {
      toast("Выберите хотя бы одну тему");
      return;
    }
    setPublishing(true);
    try {
      const r = await api.publish(initial.id);
      toast(`Сохранено ${r.count} знаний`);
      router.push("/knowledge");
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
      setPublishing(false);
    }
  }

  return (
    <div style={{ paddingBottom: 90 }}>
      <div className="page-head">
        <Link href="/inbox" className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }}>
          ← Inbox
        </Link>
        <div className="row spread wrap">
          <div>
            <h1 className="page-title">{source.title}</h1>
            <p className="page-sub">
              {source.author ? `${source.author} · ` : ""}
              AI нашёл {blocks.length} тем · выбрано {selectedCount}
            </p>
          </div>
          <div className="row">
            <Link href={`/sources/${source.id}`} className="btn btn-sm">
              📄 Посмотреть оригинал
            </Link>
          </div>
        </div>
      </div>

      <div className="stack">
        {blocks.map((b, i) => (
          <BlockCard
            key={b.id}
            block={b}
            index={i}
            total={blocks.length}
            hasTimecodes={hasTimecodes}
            sourceUrl={source.url}
            onPatch={(patch) => patchLocal(b.id, patch)}
            onReload={reload}
          />
        ))}
      </div>

      {blocks.length === 0 && (
        <div className="empty">
          <div className="empty-emoji">🤔</div>
          AI не выделил тем. Попробуйте пересобрать черновик из Inbox.
        </div>
      )}

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 248,
          right: 0,
          background: "var(--bg-elev)",
          borderTop: "1px solid var(--border)",
          padding: "14px 40px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 40,
        }}
      >
        <span className="muted">
          Выбрано <strong style={{ color: "var(--text)" }}>{selectedCount}</strong> из {blocks.length}
        </span>
        <button className="btn btn-primary" onClick={publish} disabled={publishing || !selectedCount}>
          {publishing ? <Spinner /> : null} Сохранить {selectedCount} выбранных тем
        </button>
      </div>
    </div>
  );
}

function BlockCard({
  block,
  index,
  total,
  hasTimecodes,
  sourceUrl,
  onPatch,
  onReload,
}: {
  block: DraftBlockDTO;
  index: number;
  total: number;
  hasTimecodes: boolean;
  sourceUrl: string | null;
  onPatch: (p: Partial<DraftBlockDTO>) => void;
  onReload: () => void;
}) {
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMenu, setAiMenu] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [newKp, setNewKp] = useState("");

  const save = (patch: Record<string, unknown>) => api.patchBlock(block.id, patch).catch((e) => toast((e as Error).message));

  async function toggleSelect() {
    const next = !block.selected;
    onPatch({ selected: next });
    await save({ selected: next });
  }

  async function runAi(action: string) {
    setAiMenu(false);
    setAiBusy(true);
    try {
      const { result } = await api.quick(action, block.content || block.summary);
      setPreview(result);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  }

  function acceptPreview() {
    if (preview == null) return;
    onPatch({ content: preview });
    save({ content: preview });
    setPreview(null);
  }

  async function structural(fn: () => Promise<unknown>) {
    try {
      await fn();
      onReload();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  function timecodeLink() {
    if (block.startTimestamp == null || !sourceUrl) return null;
    const url = `${sourceUrl}${sourceUrl.includes("?") ? "&" : "?"}t=${block.startTimestamp}s`;
    return (
      <a href={url} target="_blank" rel="noreferrer" className="tc">
        ⏱ {fmtTimecode(block.startTimestamp)}
        {block.endTimestamp != null ? `–${fmtTimecode(block.endTimestamp)}` : ""}
      </a>
    );
  }

  return (
    <div className={`block ${block.selected ? "selected" : "unselected"}`}>
      <div className="block-head">
        <button
          className={`check ${block.selected ? "on" : ""}`}
          onClick={toggleSelect}
          title={block.selected ? "Не сохранять" : "Сохранить"}
        >
          ✓
        </button>
        <div style={{ flex: 1 }}>
          <input
            className="input"
            style={{ fontWeight: 700, fontSize: 16, border: "none", background: "transparent", padding: "2px 0" }}
            value={block.title}
            onChange={(e) => onPatch({ title: e.target.value })}
            onBlur={(e) => save({ title: e.target.value })}
          />
          <div className="row wrap" style={{ gap: 8, marginTop: 4 }}>
            {hasTimecodes && timecodeLink()}
            {block.suggestedTopic && (
              <input
                className="chip chip-accent"
                style={{ border: "none", width: "auto", maxWidth: 260 }}
                value={block.suggestedTopic}
                onChange={(e) => onPatch({ suggestedTopic: e.target.value })}
                onBlur={(e) => save({ suggestedTopic: e.target.value })}
              />
            )}
          </div>
        </div>
      </div>

      <div className="block-body">
        {block.summary && (
          <textarea
            className="textarea"
            style={{ fontStyle: "italic", color: "var(--text-soft)", marginBottom: 10 }}
            rows={2}
            value={block.summary}
            onChange={(e) => onPatch({ summary: e.target.value })}
            onBlur={(e) => save({ summary: e.target.value })}
          />
        )}
        <textarea
          className="textarea"
          rows={4}
          value={block.content}
          onChange={(e) => onPatch({ content: e.target.value })}
          onBlur={(e) => save({ content: e.target.value })}
          placeholder="Конспект темы…"
        />

        {preview != null && (
          <div className="card pad" style={{ marginTop: 10, borderColor: "var(--accent)", background: "var(--accent-soft)" }}>
            <strong style={{ fontSize: 13 }}>✨ AI предлагает</strong>
            <p style={{ whiteSpace: "pre-wrap", margin: "6px 0 10px" }}>{preview}</p>
            <div className="row">
              <button className="btn btn-sm btn-primary" onClick={acceptPreview}>
                Принять
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => setPreview(null)}>
                Отклонить
              </button>
            </div>
          </div>
        )}

        {/* Ключевые тезисы */}
        {block.keyPoints.length > 0 && (
          <ul className="kp-list" style={{ marginTop: 12 }}>
            {block.keyPoints.map((kp, i) => (
              <li key={i} className="kp-item">
                <span>{kp}</span>
                <button
                  className="del"
                  onClick={() => {
                    const next = block.keyPoints.filter((_, j) => j !== i);
                    onPatch({ keyPoints: next });
                    save({ keyPoints: next });
                  }}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          className="input"
          style={{ marginTop: 8 }}
          value={newKp}
          onChange={(e) => setNewKp(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newKp.trim()) {
              const next = [...block.keyPoints, newKp.trim()];
              onPatch({ keyPoints: next });
              save({ keyPoints: next });
              setNewKp("");
            }
          }}
          placeholder="+ тезис (Enter)"
        />

        {block.terms.length > 0 && (
          <div className="row wrap" style={{ marginTop: 12, gap: 6 }}>
            <span className="faint" style={{ fontSize: 12 }}>Термины:</span>
            {block.terms.map((t, i) => (
              <span key={i} className="chip">{t}</span>
            ))}
          </div>
        )}
        {block.examples.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <span className="faint" style={{ fontSize: 12 }}>Примеры:</span>
            <ul style={{ margin: "4px 0 0", paddingLeft: 18 }} className="muted">
              {block.examples.map((ex, i) => (
                <li key={i}>{ex}</li>
              ))}
            </ul>
          </div>
        )}
        {block.takeaways.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <span className="faint" style={{ fontSize: 12 }}>Выводы:</span>
            <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
              {block.takeaways.map((tw, i) => (
                <li key={i}>{tw}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="divider" />
        <div className="row wrap" style={{ gap: 6, position: "relative" }}>
          <div style={{ position: "relative" }}>
            <button className="btn btn-sm btn-ghost" onClick={() => setAiMenu((v) => !v)} disabled={aiBusy}>
              {aiBusy ? <Spinner /> : "✨"} AI-действия
            </button>
            {aiMenu && (
              <div className="card" style={{ position: "absolute", top: "100%", left: 0, zIndex: 20, marginTop: 4, minWidth: 200, padding: 6 }}>
                {QUICK_ACTIONS.map((a) => (
                  <button key={a.key} className="nav-link" style={{ width: "100%" }} onClick={() => runAi(a.key)}>
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="btn btn-sm btn-ghost" onClick={() => structural(() => api.splitBlock(block.id))}>
            ✂️ Разделить
          </button>
          {index < total - 1 && (
            <button className="btn btn-sm btn-ghost" onClick={() => structural(() => api.mergeBlock(block.id))}>
              🔗 Объединить со следующим
            </button>
          )}
          <button
            className="btn btn-sm btn-danger"
            style={{ marginLeft: "auto" }}
            onClick={() => structural(() => api.deleteBlock(block.id))}
          >
            🗑 Удалить блок
          </button>
        </div>
      </div>
    </div>
  );
}
