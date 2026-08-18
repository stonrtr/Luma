import { Gauge } from "lucide-react";
import { t } from "@/lib/i18n";

type Kpi = { id: string; title: string; target: string | null; actualValue: string | null; achieved: boolean | null };

// Только отображение KPI (тільки ціль) — одним горизонтальним рядком
export function KpiStrip({ kpis, ownerName, locale = "uk" }: { kpis: Kpi[]; ownerName?: string; locale?: string }) {
  if (kpis.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 border-b px-6 py-2">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Gauge className="size-3.5" /> {t(locale, "kpi.month")}
        {ownerName && <span className="normal-case">· {ownerName}</span>}
      </span>
      {kpis.map((k) => (
        <div key={k.id} className="flex items-baseline gap-2 rounded-lg border bg-card px-3 py-1">
          <span className="text-xs text-muted-foreground">{k.title}</span>
          <span className="text-[10px] text-muted-foreground">{t(locale, "kpi.target")}</span>
          <span className="text-lg font-bold leading-none text-accent-foreground">{k.target ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}
