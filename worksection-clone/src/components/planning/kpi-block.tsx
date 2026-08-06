"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gauge, Plus, X, Check } from "lucide-react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { addKpi, deleteKpi, updateKpiResult, updateKpiTarget } from "@/server/actions/planning";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Kpi = { id: string; title: string; target: string | null; actualValue: string | null; achieved: boolean | null };

export function KpiBlock({
  userId, year, month, kpis, canManage, canEditResult,
}: {
  userId: string; year: number; month: number; kpis: Kpi[]; canManage: boolean; canEditResult: boolean;
}) {
  const router = useRouter();
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

  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <Gauge className="size-4 text-primary" /> KPI місяця
      </h3>
      <div className="space-y-2">
        {kpis.map((k) => (
          <KpiRow key={k.id} kpi={k} canManage={canManage} canEditResult={canEditResult} />
        ))}
        {kpis.length === 0 && <p className="text-sm text-muted-foreground">KPI поки немає.</p>}
      </div>
      {canManage && (
        <div className="mt-2 flex gap-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Назва KPI" className="h-8 flex-1" />
          <Input value={target} onChange={(e) => setTarget(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Ціль" className="h-8 w-24" />
          <button onClick={add} className="flex size-8 shrink-0 items-center justify-center rounded-md border hover:bg-muted"><Plus className="size-4" /></button>
        </div>
      )}
    </div>
  );
}

function KpiRow({ kpi, canManage, canEditResult }: { kpi: Kpi; canManage: boolean; canEditResult: boolean }) {
  const router = useRouter();
  const [actual, setActual] = useState(kpi.actualValue ?? "");
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetVal, setTargetVal] = useState(kpi.target ?? "");
  const [, start] = useTransition();

  function save(achieved: boolean | null) {
    start(async () => {
      await updateKpiResult({ id: kpi.id, actualValue: actual, achieved });
      toast.success("Збережено");
      router.refresh();
    });
  }
  function saveTarget() {
    setEditingTarget(false);
    if (targetVal !== (kpi.target ?? "")) {
      start(async () => {
        await updateKpiTarget({ id: kpi.id, target: targetVal });
        toast.success("Ціль оновлено");
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
              title={canManage ? "Редагувати ціль" : undefined}
            >
              <span className="text-[11px] text-muted-foreground">ціль</span>
              <span className="text-xl font-bold text-primary">{kpi.target ?? "—"}</span>
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
          placeholder="Факт"
          disabled={!canEditResult}
          className="h-8 w-28"
        />
        <button
          disabled={!canEditResult}
          onClick={() => save(true)}
          className={cn("rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
            kpi.achieved === true ? "border-emerald-500 bg-emerald-500/10 text-emerald-600" : "hover:bg-muted")}
        >
          <Check className="mr-1 inline size-3" /> Досягнуто
        </button>
        <button
          disabled={!canEditResult}
          onClick={() => save(false)}
          className={cn("rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
            kpi.achieved === false ? "border-destructive bg-destructive/10 text-destructive" : "hover:bg-muted")}
        >
          Не досягнуто
        </button>
      </div>
    </div>
  );
}
