import Link from "next/link";
import { requireUser } from "@/server/dal";
import { t, projectStatusLabel } from "@/lib/i18n";
import { getTaskReport, type ReportPeriod } from "@/server/queries/reports";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { ReportExport } from "@/components/reports/report-export";
import { ReportDateRange } from "@/components/reports/report-date-range";
import { PROJECT_STATUS_STYLE } from "@/lib/domain";
import { cn } from "@/lib/utils";

const PERIODS: { key: ReportPeriod; label: string }[] = [
  { key: "week", label: "rep.week" },
  { key: "month", label: "rep.month" },
  { key: "quarter", label: "rep.quarter" },
  { key: "all", label: "rep.all" },
];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const custom = sp.from && sp.to ? { from: sp.from, to: sp.to } : undefined;
  const period = (custom ? "custom" : ["week", "month", "quarter", "all"].includes(sp.period ?? "") ? sp.period : "month") as ReportPeriod;
  const r = await getTaskReport(period, custom);
  const loc = user.locale;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t(loc, "page.reports")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t(loc, "rep.tasksSub")}</p>
        </div>
        <ReportExport />
      </div>

      {/* Период + произвольный диапазон */}
      <div className="mt-4 flex flex-wrap items-center gap-2 print:hidden">
        <div className="flex flex-wrap gap-1">
          {PERIODS.map((p) => (
            <Link key={p.key} href={`/reports?period=${p.key}`}
              className={cn("rounded-full px-3 py-1 text-sm transition-colors",
                period === p.key ? "border border-[#B7EE7A] bg-accent text-accent-foreground dark:border-[#3f5a2e]" : "bg-muted text-muted-foreground hover:bg-accent")}>
              {t(loc, p.label)}
            </Link>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{t(loc, "rep.orDates")}</span>
        <ReportDateRange from={custom?.from} to={custom?.to} />
      </div>

      {/* Плитки: результат команды одним взглядом */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Tile value={String(r.doneTotal)} label={t(loc, "rep.tasksDone")} />
        <Tile value={String(r.inProgressTotal)} label={t(loc, "rep.inProgress")} />
        <Tile value={String(r.overdueTotal)} label={t(loc, "rep.overdue")} accent={r.overdueTotal > 0 ? "bad" : undefined} />
        <Tile value={r.onTimePct == null ? "—" : `${r.onTimePct}%`} label={t(loc, "rep.onTimePct")} accent={r.onTimePct != null && r.onTimePct < 60 ? "over" : undefined} />
        <Tile value={r.kpiTotal ? `${r.kpiDone}/${r.kpiTotal}` : "—"} label={t(loc, "rep.kpiDone")} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* По людям — задачи и KPI */}
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold">{t(loc, "rep.byPeople")}</h2>
          <div className="space-y-3">
            {r.byUser.map((u) => (
              <div key={u.id} className="flex items-center gap-2 text-sm">
                <Avatar className="size-6"><AvatarFallback className="text-[9px]">{initials(u.name)}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate">{u.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {u.done > 0 && <>{u.onTime}/{u.done} {t(loc, "rep.onTimeWord")}</>}
                    {u.done > 0 && u.kpiTotal > 0 && " · "}
                    {u.kpiTotal > 0 && <>KPI {u.kpiDone}/{u.kpiTotal}</>}
                    {u.done === 0 && u.kpiTotal === 0 && "—"}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Chip n={u.done} label={t(loc, "rep.done")} tone="green" />
                  <Chip n={u.inProgress} label={t(loc, "rep.inWorkShort")} tone="muted" />
                  <Chip n={u.overdue} label={t(loc, "rep.overdueShort")} tone="red" />
                </div>
              </div>
            ))}
            {r.byUser.length === 0 && <p className="text-sm text-muted-foreground">{t(loc, "rep.noData")}</p>}
          </div>
        </section>

        {/* По проектам — готовность и риск */}
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold">{t(loc, "rep.byProjects")}</h2>
          <div className="space-y-3">
            {r.byProject.map((p) => {
              const totalRef = p.active + p.done;
              const readiness = totalRef ? Math.round((p.done / totalRef) * 100) : 0;
              return (
                <div key={p.id}>
                  <div className="mb-1 flex items-center gap-2 text-sm">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", PROJECT_STATUS_STYLE[p.status as keyof typeof PROJECT_STATUS_STYLE])}>{projectStatusLabel(loc, p.status)}</span>
                    {p.overdue > 0 && <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">{p.overdue} {t(loc, "rep.overdueShort")}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${readiness}%` }} />
                    </div>
                    <span className="w-28 shrink-0 text-right text-[11px] text-muted-foreground">
                      {p.done} {t(loc, "rep.done")} · {p.active} {t(loc, "rep.activeShort")}
                    </span>
                  </div>
                </div>
              );
            })}
            {r.byProject.length === 0 && <p className="text-sm text-muted-foreground">{t(loc, "rep.noProjects")}</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

function Tile({ value, label, accent }: { value: string; label: string; accent?: "bad" | "over" }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className={cn("text-2xl font-semibold", accent === "bad" && "text-destructive", accent === "over" && "text-[#A0561F] dark:text-[#e2b382]")}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Chip({ n, label, tone }: { n: number; label: string; tone: "green" | "red" | "muted" }) {
  if (n === 0) return null;
  const cls = tone === "green" ? "bg-accent text-accent-foreground"
    : tone === "red" ? "bg-destructive/10 text-destructive"
    : "bg-muted text-muted-foreground";
  return <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", cls)}>{n} {label}</span>;
}
