"use client";

import { useEffect, useRef, useState } from "react";
import "@univerjs/presets/lib/styles/preset-sheets-core.css";
import { saveSpreadsheet } from "@/server/actions/spreadsheets";
import { univerUkOverlay } from "@/lib/univer-uk";
import { SheetOwnerPicker } from "@/components/sheets/sheet-owner-picker";

// Редактируемая таблица на Univer (формулы, форматирование, несколько листов, xlsx).
// Автосохранение снапшота книги в БД.
export function SpreadsheetEditor({
  id, initialData, owners, currentId, selfId,
}: {
  id: string;
  initialData: string;
  owners?: { id: string; name: string }[];
  currentId?: string;
  selfId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>(initialData || "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    let disposed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let univer: any;

    (async () => {
      const [presets, core, locale] = await Promise.all([
        import("@univerjs/presets"),
        import("@univerjs/presets/preset-sheets-core"),
        import("@univerjs/presets/preset-sheets-core/locales/ru-RU"),
      ]);
      if (disposed || !ref.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { createUniver, defaultTheme, LocaleType, merge } = presets as any;
      const created = createUniver({
        // Украинский UI: ru-RU как база + наш uk-оверлей поверх (uk-UA в пакете нет)
        locale: LocaleType.RU_RU,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        locales: { [LocaleType.RU_RU]: merge({}, (locale as any).default, univerUkOverlay) },
        theme: defaultTheme,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        presets: [(core as any).UniverSheetsCorePreset({ container: ref.current })],
      });
      univer = created.univer;
      const univerAPI = created.univerAPI;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any;
      try { data = initialData ? JSON.parse(initialData) : undefined; } catch { data = undefined; }
      try { univerAPI.createWorkbook(data && typeof data === "object" ? data : {}); }
      catch { univerAPI.createWorkbook({}); }

      univerAPI.onCommandExecuted(() => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(async () => {
          const wb = univerAPI.getActiveWorkbook?.();
          const snap = wb?.save ? wb.save() : wb?.getSnapshot?.();
          if (!snap) return;
          const json = JSON.stringify(snap);
          if (json === lastSaved.current) return; // без изменений — не пишем
          setStatus("saving");
          const r = await saveSpreadsheet({ id, data: json });
          if (r?.error) setStatus("idle");
          else { lastSaved.current = json; setStatus("saved"); }
        }, 1000);
      });
    })();

    return () => {
      disposed = true;
      if (timer.current) clearTimeout(timer.current);
      try { univer?.dispose?.(); } catch { /* уже размонтирован */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="relative h-full w-full" data-sheet-editor>
      <div ref={ref} className="h-full w-full" />
      {/* Оверлей в правой части ряда вкладок ленты: переключатель таблиц + статус сохранения */}
      <div className="pointer-events-none absolute right-2 top-1 z-20 flex items-center gap-2">
        {status !== "idle" && (
          <span className="rounded bg-card/80 px-1.5 text-[11px] text-muted-foreground">
            {status === "saving" ? "сохранение…" : "✓ сохранено"}
          </span>
        )}
        {owners && owners.length > 1 && currentId && selfId && (
          <span className="pointer-events-auto">
            <SheetOwnerPicker owners={owners} currentId={currentId} selfId={selfId} />
          </span>
        )}
      </div>
    </div>
  );
}
