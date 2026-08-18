"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";

// Произвольный диапазон дат для отчёта: при заполнении обоих полей — переход на /reports?from&to.
export function ReportDateRange({ from, to }: { from?: string; to?: string }) {
  const router = useRouter();
  const [f, setF] = useState(from ?? "");
  const [t, setT] = useState(to ?? "");

  function go(nf: string, nt: string) {
    if (nf && nt) router.push(`/reports?from=${nf}&to=${nt}`);
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input type="date" aria-label="from" value={f} max={t || undefined}
        onChange={(e) => { setF(e.target.value); go(e.target.value, t); }} className="h-8 w-[9.5rem]" />
      <span className="text-muted-foreground">—</span>
      <Input type="date" aria-label="to" value={t} min={f || undefined}
        onChange={(e) => { setT(e.target.value); go(f, e.target.value); }} className="h-8 w-[9.5rem]" />
    </div>
  );
}
