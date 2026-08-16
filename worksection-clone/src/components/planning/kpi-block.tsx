"use client";
import { useT } from "@/lib/locale-context";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gauge, Plus, X, Check } from "lucide-react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { addKpi, deleteKpi, updateKpiResult, updateKpiTarget } from "@/server/actions/planning";
import { Input } from "@/components/ui/input";
import { monthLabel } from "@/lib/week";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Kpi = { id: string; title: string; target: string | null; actualValue: string | null; achieved: boolean | null };

const MIN_KPI_SLOTS = 2;

export function KpiBlock({
  userId, year, month, kpis, canManage, canEditResult, locale,
}: {
  userId: string; year: number; month: number; kpis: Kpi[]; canManage: boolean; canEditResult: boolean; locale: string;
}) {
  const router = useRouter();
  const tr = useT();
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [, start] = useTransition();

  function add() {
    if (!title.trim()) return;
    const t = title.trim(); const tg = target.trim();
    setTitle(""); setTarget("");
    start(async () => {
      const res = await addKpi({ userId, title: t, target: tg, year, month });
      if (res?.error) toast.error(res.error);
      router.refresh();
    });
  }

  const emptySlots = Math.max(0, MIN_KPI_SLOTS - kpis.length);

  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <Gauge className="size-4 text-accent-foreground" /> {t(locale, "kpi.month")} · {monthLabel(month, locale)}
      </h3>
      <div className="space-y-2">
        {kpis.map((k) => (
          <KpiRow key={k.id} kpi={k} canManage={canManage} canEditResult={canEditResult} locale={locale} />
        ))}
        {/* пустые слоты-заготовки до минимума */}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <div key={`kpi-slot-${i}`} className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
            <Gauge className="size-4 opacity-50" />
            {canManage ? t(locale, "kpi.emptySlot") : t(locale, "kpi.notSet")}
          </div>
        ))}
      </div>
      {canManage && (
        <div className="mt-2 flex gap-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t(locale, "kpi.namePh")} className="h-8 flex-1" />
          <Input value={target} onChange={(e) => setTarget(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder={t(locale, "kpi.goalPh")} className="h-8 w-24" />
          <button onClick={add} className="flex size-8 shrink-0 items-center justify-center rounded-md border hover:bg-muted"><Plus className="size-4" /></button>
        </div>
      )}
    </div>
  );
}

function KpiRow({ kpi, canManage, canEditResult, locale }: { kpi: Kpi; canManage: boolean; canEditResult: boolean; locale: string }) {
  const router = useRouter();
  const tr = useT();
  const [actual, setActual] = useState(kpi.actualValue ?? "");
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetVal, setTargetVal] = useState(kpi.target ?? "");
  const [, start] = useTransition();

  function save(achieved: boolean | null) {
    start(async () => {
      await updateKpiResult({ id: kpi.id, actualValue: actual, achieved });
      toast.success(tr("common.saved"));
      router.refresh();
    });
  }
  function saveTarget() {
    setEditingTarget(false);
    if (targetVal !== (kpi.target ?? "")) {
      start(async () => {
        await updateKpiTarget({ id: kpi.id, target: targetVal });
        toast.success(tr("kpi.goalUpdated"));
        router.refresh();
      });
    }
  }

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium">{kpi.title}</span>
        <div className="flex items-center gap-2">
          {/* Цель — крупно и редактируемо */}
          {editingTarget ? (
            <Input
              value={targetVal}
              onChange={(e) => setTargetVal(e.target.value)}
              onBlur={saveTarget}
              onKeyDown={(e) => { if (e.key === "Enter") saveTarget(); if (e.key === "Escape") { setTargetVal(kpi.target ?? ""); setEditingTarget(false); } }}
              autoFocus
              className="h-8 w-24 text-right text-lg font-bold"
            />
          ) : (
            <button
              onClick={() => canManage && setEditingTarget(true)}
              disabled={!canManage}
              className="group flex items-baseline gap-1"
              title={canManage ? tr("kpi.editGoal") : undefined}
            >
              <span className="text-[11px] text-muted-foreground">{t(locale, "kpi.target")}</span>
              <span className="text-xl font-bold text-accent-foreground">{kpi.target ?? "—"}</span>
              {canManage && <Pencil className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />}
            </button>
          )}
          {canManage && (
            <button onClick={() => start(async () => { await deleteKpi(kpi.id); router.refresh(); })} className="text-muted-foreground hover:text-destructive">
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Input
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && canEditResult) save(kpi.achieved); }}
          onBlur={() => canEditResult && actual !== (kpi.actualValue ?? "") && save(kpi.achieved)}
          placeholder={t(locale, "kpi.fact")}
          disabled={!canEditResult}
          className="h-8 w-28"
        />
      </div>
    </div>
  );
}


// Тогл «Досягнуто / Не досягнуто» для АРХІВУ KPI: підсумок місяця відмічається
// після його завершення (активна картка місяця цих кнопок не має).
export function KpiAchievedToggle({ id, actualValue, achieved, locale }: { id: string; actualValue: string | null; achieved: boolean | null; locale: string }) {
  const router = useRouter();
  const [, start] = useTransition();
  const save = (v: boolean) => start(async () => {
    await updateKpiResult({ id, actualValue: actualValue ?? "", achieved: achieved === v ? null : v });
    router.refresh();
  });
  return (
    <span className="flex items-center gap-1">
      <button
        onClick={() => save(true)}
        className={cn("rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors",
          achieved === true ? "border-primary bg-accent text-accent-foreground" : "hover:bg-muted")}
      >
        <Check className="mr-0.5 inline size-3" /> {t(locale, "kpi.achievedShort")}
      </button>
      <button
        onClick={() => save(false)}
        className={cn("rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors",
          achieved === false ? "border-destructive bg-destructive/10 text-destructive" : "hover:bg-muted")}
      >
        {t(locale, "kpi.notAchievedShort")}
      </button>
    </span>
  );
}
