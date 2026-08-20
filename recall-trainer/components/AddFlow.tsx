"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { KnowledgeEditor } from "./KnowledgeEditor";
import { Modal, Spinner, toast } from "./ui";

type Screen = "menu" | "youtube" | "text" | "manual" | "processing";

// Универсальная кнопка + (§32). Управляет всеми способами добавления.
export function AddFlow({ variant = "sidebar" }: { variant?: "sidebar" | "big" }) {
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<Screen>("menu");

  function start(s?: Screen) {
    setScreen(s ?? "menu");
    setOpen(true);
  }

  return (
    <>
      {variant === "sidebar" ? (
        <button className="btn btn-primary btn-block add-btn" onClick={() => start("menu")}>
          ＋ Добавить
        </button>
      ) : (
        <div className="row wrap">
          <button className="btn btn-primary" onClick={() => start("manual")}>
            ✍️ Написать
          </button>
          <button className="btn" onClick={() => start("youtube")}>
            ▶️ YouTube
          </button>
          <button className="btn" onClick={() => start("text")}>
            📄 Разобрать текст
          </button>
        </div>
      )}
      {open && <AddDialog screen={screen} setScreen={setScreen} onClose={() => setOpen(false)} />}
    </>
  );
}

function AddDialog({
  screen,
  setScreen,
  onClose,
}: {
  screen: Screen;
  setScreen: (s: Screen) => void;
  onClose: () => void;
}) {
  if (screen === "manual") {
    return <KnowledgeEditor onClose={onClose} />;
  }
  if (screen === "youtube") return <YoutubeForm onBack={() => setScreen("menu")} onClose={onClose} />;
  if (screen === "text") return <TextForm onBack={() => setScreen("menu")} onClose={onClose} />;

  return (
    <Modal onClose={onClose} className="add-menu">
      <h2 className="modal-title">Добавить</h2>
      <p className="muted" style={{ marginTop: 0, marginBottom: 16, fontSize: 13.5 }}>
        Источник → AI-обработка → черновик → вы выбираете, что сохранить.
      </p>
      <button className="add-opt" onClick={() => setScreen("manual")}>
        <span className="em">✍️</span>
        <span>
          <strong>Написать самому</strong>
          <br />
          <span className="muted" style={{ fontSize: 13 }}>Сразу в базу знаний, без обработки</span>
        </span>
      </button>
      <button className="add-opt" onClick={() => setScreen("youtube")}>
        <span className="em">▶️</span>
        <span>
          <strong>YouTube-видео</strong>
          <br />
          <span className="muted" style={{ fontSize: 13 }}>Транскрипция → темы → конспект</span>
        </span>
      </button>
      <button className="add-opt" onClick={() => setScreen("text")}>
        <span className="em">📄</span>
        <span>
          <strong>Разобрать текст / статью</strong>
          <br />
          <span className="muted" style={{ fontSize: 13 }}>AI разобьёт на темы и тезисы</span>
        </span>
      </button>
      <div className="divider" />
      <p className="faint" style={{ fontSize: 12, margin: "0 0 8px" }}>Позже</p>
      {["📕 PDF", "🔗 Ссылка", "🖼 Фото", "🎙 Голос"].map((l) => (
        <button key={l} className="add-opt disabled" disabled>
          <span className="em">{l.split(" ")[0]}</span>
          <span className="muted">{l.split(" ")[1]}</span>
        </button>
      ))}
    </Modal>
  );
}

function YoutubeForm({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [needTranscript, setNeedTranscript] = useState<string | null>(null); // sourceId
  const [transcript, setTranscript] = useState("");

  async function go() {
    if (!url.trim()) return;
    setBusy(true);
    try {
      const r = await api.createSource({ kind: "youtube", url: url.trim() });
      if (r.draftId) {
        onClose();
        router.push(`/drafts/${r.draftId}`);
      } else if (r.needTranscript) {
        setNeedTranscript(r.sourceId);
      } else {
        toast(r.error || "Не удалось обработать");
      }
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitTranscript() {
    if (!needTranscript || !transcript.trim()) return;
    setBusy(true);
    try {
      await api.updateSource(needTranscript, { rawContent: transcript.trim() });
      const r = await api.reprocess(needTranscript);
      if (r.draftId) {
        onClose();
        router.push(`/drafts/${r.draftId}`);
      } else {
        toast(r.error || "Не удалось обработать");
      }
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={busy ? () => {} : onClose}>
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 10 }}>
        ← Назад
      </button>
      <h2 className="modal-title">YouTube-видео</h2>
      {!needTranscript ? (
        <>
          <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>
            Вставьте ссылку — получим субтитры и AI сделает конспект по темам.
          </p>
          <input
            className="input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && !busy && go()}
          />
          {busy && (
            <div className="row" style={{ marginTop: 14, color: "var(--text-soft)" }}>
              <Spinner /> Получаем видео и разбираем на темы… это может занять до минуты.
            </div>
          )}
          <div className="row spread" style={{ marginTop: 18 }}>
            <span />
            <button className="btn btn-primary" onClick={go} disabled={busy || !url.trim()}>
              {busy ? <Spinner /> : null} Обработать
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="chip chip-amber" style={{ marginBottom: 10 }}>Субтитры не найдены</div>
          <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>
            У видео нет субтитров. Вставьте текст расшифровки вручную — и AI разберёт его на темы.
          </p>
          <textarea
            className="textarea"
            rows={7}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Вставьте транскрипт видео…"
            autoFocus
          />
          <div className="row spread" style={{ marginTop: 14 }}>
            <span />
            <button className="btn btn-primary" onClick={submitTranscript} disabled={busy || !transcript.trim()}>
              {busy ? <Spinner /> : null} Разобрать
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function TextForm({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function go() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await api.createSource({ kind: "text", type: "ARTICLE", title, text: text.trim() });
      if (r.draftId) {
        onClose();
        router.push(`/drafts/${r.draftId}`);
      } else {
        toast(r.error || "Не удалось обработать");
      }
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={busy ? () => {} : onClose} width={620}>
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 10 }}>
        ← Назад
      </button>
      <h2 className="modal-title">Разобрать текст</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>
        Вставьте статью или большой текст — AI разобьёт его на темы и тезисы.
      </p>
      <div className="field">
        <label className="label">Название (необязательно)</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Заголовок материала" />
      </div>
      <div className="field">
        <label className="label">Текст</label>
        <textarea className="textarea" rows={9} value={text} onChange={(e) => setText(e.target.value)} placeholder="Вставьте текст…" autoFocus />
      </div>
      {busy && (
        <div className="row" style={{ marginBottom: 12, color: "var(--text-soft)" }}>
          <Spinner /> AI разбирает текст на темы…
        </div>
      )}
      <div className="row spread">
        <span />
        <button className="btn btn-primary" onClick={go} disabled={busy || !text.trim()}>
          {busy ? <Spinner /> : null} Разобрать
        </button>
      </div>
    </Modal>
  );
}
