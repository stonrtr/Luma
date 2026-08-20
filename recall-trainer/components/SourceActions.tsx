"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Modal, Spinner, toast } from "./ui";

export function SourceActions({
  sourceId,
  status,
  compact,
}: {
  sourceId: string;
  status: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);

  async function reprocess() {
    setBusy(true);
    try {
      const r = await api.reprocess(sourceId);
      if (r.draftId) {
        router.push(`/drafts/${r.draftId}`);
      } else if (r.needTranscript) {
        setTranscript("");
      } else {
        toast(r.error || "Не удалось");
        router.refresh();
      }
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitTranscript() {
    if (transcript == null || !transcript.trim()) return;
    setBusy(true);
    try {
      await api.updateSource(sourceId, { rawContent: transcript.trim() });
      const r = await api.reprocess(sourceId);
      if (r.draftId) router.push(`/drafts/${r.draftId}`);
      else toast(r.error || "Не удалось");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!confirm("Удалить источник и связанный черновик?")) return;
    setBusy(true);
    try {
      await api.deleteSource(sourceId);
      toast("Удалено");
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="row" style={{ gap: 6 }}>
      <button className="btn btn-sm btn-ghost" onClick={reprocess} disabled={busy} title="Пересобрать черновик">
        {busy ? <Spinner /> : "🔄"} {compact ? "" : "Пересобрать"}
      </button>
      {status === "ERROR" && (
        <button className="btn btn-sm" onClick={() => setTranscript("")} disabled={busy}>
          ✍️ Вставить транскрипт
        </button>
      )}
      <button className="btn btn-sm btn-danger" onClick={del} disabled={busy}>
        🗑
      </button>

      {transcript != null && (
        <Modal onClose={() => setTranscript(null)} width={620}>
          <h2 className="modal-title">Вставить транскрипт</h2>
          <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>
            Вставьте текст расшифровки — AI разберёт его на темы.
          </p>
          <textarea
            className="textarea"
            rows={8}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            autoFocus
          />
          <div className="row spread" style={{ marginTop: 14 }}>
            <span />
            <button className="btn btn-primary" onClick={submitTranscript} disabled={busy || !transcript.trim()}>
              {busy ? <Spinner /> : null} Разобрать
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
