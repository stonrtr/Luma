"use client";
import { useT } from "@/lib/locale-context";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trophy, ChevronDown, Pencil, Plus, X, Check, Lock } from "lucide-react";
import { saveWeeklyWin } from "@/server/actions/wins";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { isoWeekNumber, weekLabel } from "@/lib/week";

type ArchiveWin = { weekStart: string; text: string };

const toPoints = (t: string) => t.split("\n").map((s) => s.trim()).filter(Boolean);
const joinPoints = (pts: string[]) => pts.map((s) => s.trim()).filter(Boolean).join("\n");

// Редактор пунктов 1, 2, 3, 4…
function PointsEditor({ initial, onSave, onCancel, saving, saveLabel }: {
  initial: string[]; onSave: (pts: string[]) => void; onCancel?: () => void; saving: boolean; saveLabel: string;
}) {
  const tr = useT();
  const [pts, setPts] = useState<string[]>(initial.length ? initial : ["", "", ""]);
  const empty = joinPoints(pts).length === 0;

  return (
    <div>
      <ul className="space-y-1.5">
        {pts.map((p, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="flex size-5 shrink-0 items-center justify-center rounded bg-muted text-[11px] font-semibold text-muted-foreground">{i + 1}</span>
            <Input value={p} onChange={(e) => setPts((a) => a.map((x, idx) => (idx === i ? e.target.value : x)))} placeholder={tr("wins.pointPh")} className="h-8" />
            <button onClick={() => setPts((a) => (a.length > 1 ? a.filter((_, idx) => idx !== i) : a))} className="shrink-0 text-muted-foreground/50 transition-colors hover:text-destructive" title={tr("common.cancel")}>
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <button onClick={() => setPts((a) => [...a, ""])} className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
        <Plus className="size-3.5" /> {tr("wins.addPoint")}
      </button>
      <div className="mt-2 flex justify-end gap-2">
        {onCancel && <Button size="sm" variant="outline" disabled={saving} onClick={onCancel}>{tr("common.cancel")}</Button>}
        <Button size="sm" disabled={saving || empty} onClick={() => onSave(pts)}>{saveLabel}</Button>
      </div>
    </div>
  );
}

// Верх: пока не зафиксировано — форма пунктов; после фиксации — блок уходит в архив.
export function WeeklyWins({ weekStart, current, filled, canRecord, canEdit }: {
  weekStart: string; current: string; filled: boolean; canRecord: boolean; canEdit: boolean;
}) {
  const router = useRouter();
  const tr = useT();
  const [pending, start] = useTransition();
  const weekNum = isoWeekNumber(new Date(weekStart));

  function save(pts: string[]) {
    start(async () => {
      const r = await saveWeeklyWin({ weekStart, text: joinPoints(pts) });
      if (r?.error) toast.error(r.error);
      else { toast.success(tr("wins.fixed")); router.refresh(); }
    });
  }

  return (
    <div>
      <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
        <Trophy className="size-4 text-accent-foreground" /> {tr("wins.title")} №{weekNum}
      </h3>
      <p className="mb-2 text-xs text-muted-foreground">{tr("wins.hint")}</p>

      {!canEdit ? (
        current ? (
          <ol className="space-y-1 text-sm text-muted-foreground">
            {toPoints(current).map((p, i) => <li key={i} className="flex gap-2"><span className="text-muted-foreground/60">{i + 1}.</span><span>{p}</span></li>)}
          </ol>
        ) : <p className="text-sm text-muted-foreground">—</p>
      ) : filled ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
          <Check className="size-4 shrink-0 text-accent-foreground" /> {tr("wins.fixedNote")}
        </div>
      ) : !canRecord ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" /> {tr("wins.lockedUntilFriday")}
        </div>
      ) : (
        <PointsEditor initial={toPoints(current)} onSave={save} saving={pending} saveLabel={tr("wins.fix")} />
      )}
    </div>
  );
}

// Архив побед: все зафиксированные недели (включая текущую после фиксации). Правится.
export function WeeklyWinsArchive({ archive, canEdit, locale }: { archive: ArchiveWin[]; canEdit: boolean; locale: string }) {
  const tr = useT();
  if (archive.length === 0) return <p className="text-sm text-muted-foreground">{tr("plan.archiveEmpty")}</p>;
  return (
    <div className="space-y-1.5">
      {archive.map((w) => <ArchiveRow key={w.weekStart} win={w} canEdit={canEdit} locale={locale} />)}
    </div>
  );
}

function ArchiveRow({ win, canEdit, locale }: { win: ArchiveWin; canEdit: boolean; locale: string }) {
  const router = useRouter();
  const tr = useT();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const num = isoWeekNumber(new Date(win.weekStart));
  const points = toPoints(win.text);

  function save(pts: string[]) {
    start(async () => {
      const r = await saveWeeklyWin({ weekStart: win.weekStart, text: joinPoints(pts) });
      if (r?.error) toast.error(r.error);
      else { setEditing(false); toast.success(tr("common.saved")); router.refresh(); }
    });
  }

  return (
    <details className="group rounded-lg border bg-muted/20 px-3 py-2">
      <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">{tr("plan.week")} №{num} <span className="text-xs text-muted-foreground">· {weekLabel(new Date(win.weekStart), locale)}</span></span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-2">
        {editing ? (
          <PointsEditor initial={points} onSave={save} onCancel={() => setEditing(false)} saving={pending} saveLabel={tr("common.save")} />
        ) : (
          <div className="flex items-start justify-between gap-2">
            {points.length > 0 ? (
              <ol className="min-w-0 flex-1 space-y-1 text-sm text-muted-foreground">
                {points.map((p, i) => <li key={i} className="flex gap-2"><span className="text-muted-foreground/60">{i + 1}.</span><span>{p}</span></li>)}
              </ol>
            ) : (
              <p className="min-w-0 flex-1 text-sm italic text-muted-foreground/70">{tr("wins.emptyWeek")}</p>
            )}
            {canEdit && (
              <button onClick={() => setEditing(true)} className="shrink-0 text-muted-foreground/60 transition-colors hover:text-foreground" title={points.length ? tr("wins.edit") : tr("wins.fix")}>
                <Pencil className="size-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </details>
  );
}
