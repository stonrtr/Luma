"use client";

import { createPortal } from "react-dom";
import { useT } from "@/lib/locale-context";

import { useEffect, useRef, useState } from "react";
import { NotebookPen, Check, Loader2, X } from "lucide-react";
import { saveNote } from "@/server/actions/notes";
import { cn } from "@/lib/utils";

type Status = "idle" | "saving" | "saved";

// Личный скретчпад: кнопка в шапке + выезжающая панель с авто-сохраняемым markdown.
export function Scratchpad({ initialBody }: { initialBody: string }) {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState(initialBody);
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef(initialBody);

  function flush() {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (body === lastSaved.current) return;
    const val = body;
    void saveNote({ body: val }).then(() => { lastSaved.current = val; setStatus("saved"); }).catch(() => {});
  }

  function onChange(next: string) {
    setBody(next);
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const val = next;
      void saveNote({ body: val }).then(() => { lastSaved.current = val; setStatus("saved"); }).catch(() => setStatus("idle"));
    }, 700);
  }

  // Хоткей «x» (физическая клавиша, независимо от раскладки) — открыть заметки.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      if (e.code === "KeyX") { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Esc закрывает; при закрытии дописываем несохранённое
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { flush(); setOpen(false); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, body]);

  return (
    <>
      <button
        onClick={() => { if (open) flush(); setOpen((o) => !o); }} // тогл: відкриває і закриває (із збереженням)
        title={tr("nav.notes")}
        aria-label={tr("nav.notes")}
        className="relative flex size-8 items-center justify-center rounded-md hover:bg-muted"
      >
        <NotebookPen className="size-4 text-muted-foreground" />
      </button>

      {/* Портал в body: fixed внутри хедера ломается его dark:backdrop-blur
          (backdrop-filter делает предка containing block для fixed) */}
      {open && createPortal(
        <div className="fixed inset-x-0 bottom-0 top-14 z-30">
          <button aria-label="close" onClick={() => { flush(); setOpen(false); }} className="absolute inset-0 bg-black/20" />
          <aside className="absolute bottom-0 left-0 top-0 flex w-[380px] max-w-[90vw] flex-col rounded-tr-2xl border-r border-t bg-card shadow-2xl">
            <div className="flex items-center gap-2 rounded-tr-2xl border-b px-4 py-3">
              <NotebookPen className="size-4 text-accent-foreground" />
              <span className="text-sm font-semibold">{tr("nav.notes")}</span>
              <span className="flex-1" />
              <span className={cn("flex items-center gap-1 text-xs transition-opacity", status === "idle" && "opacity-0", status === "saving" ? "text-muted-foreground" : "text-accent-foreground")}>
                {status === "saving" ? <><Loader2 className="size-3.5 animate-spin" /> {tr("note.saving")}</>
                  : <><Check className="size-3.5" /> {tr("note.saved")}</>}
              </span>
              <button onClick={() => { flush(); setOpen(false); }} className="ml-1 grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="close">
                <X className="size-4" />
              </button>
            </div>

            <textarea
              autoFocus
              spellCheck={false}
              value={body}
              onChange={(e) => onChange(e.target.value)}
              placeholder={tr("note.placeholder")}
              className="flex-1 resize-none bg-transparent px-4 py-3 text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
            />

            <div className="border-t px-4 py-2.5 text-xs text-muted-foreground">{tr("note.hint")}</div>
          </aside>
        </div>,
        document.body,
      )}
    </>
  );
}
