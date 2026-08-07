import { Gauge } from "lucide-react";

type Kpi = { id: string; title: string; target: string | null; actualValue: string | null; achieved: boolean | null };

// Только отображение KPI (тільки ціль) — одним горизонтальним рядком
export function KpiStrip({ kpis, ownerName }: { kpis: Kpi[]; ownerName?: string }) {
  if (kpis.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 border-b px-6 py-2">
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Gauge className="size-3.5" /> KPI місяця
        {ownerName && <span className="normal-case">· {ownerName}</span>}
      </span>
      {kpis.map((k) => (
        <div key={k.id} className="flex items-baseline gap-2 rounded-lg border bg-card px-3 py-1">
          <span className="text-xs text-muted-foreground">{k.title}</span>
          <span className="text-[10px] text-muted-foreground">ціль</span>
          <span className="text-lg font-bold leading-none text-primary">{k.target ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}
