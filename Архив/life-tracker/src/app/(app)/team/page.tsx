import Link from "next/link";
import { requireUser } from "@/server/dal";
import { getVectorsOverview, type VectorOverview } from "@/server/queries/projects";
import { isAdmin } from "@/server/authz";
import { NewProjectDialog } from "@/components/project/new-project-dialog";
import { TASK_STATUS_DOT } from "@/lib/domain";
import { formatDate, formatMinutes } from "@/lib/format";
import { Clock } from "lucide-react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Порядок сортування: спершу те, що потребує уваги (застій), потім спокій, рух, завершене.
const MOMENTUM_ORDER: Record<VectorOverview["momentum"], number> = { stalled: 0, idle: 1, active: 2, done: 3 };

const MOMENTUM_STYLE: Record<VectorOverview["momentum"], string> = {
  stalled: "bg-[#FBE0E0] text-[#A03232] dark:bg-[#331414] dark:text-[#e2a0a0]",
  idle: "bg-muted text-muted-foreground",
  active: "bg-accent text-accent-foreground",
  done: "bg-[#DCEAF6] text-[#2C5E7A] dark:bg-[#132a36] dark:text-[#8fc6e2]",
};
const MOMENTUM_KEY: Record<VectorOverview["momentum"], string> = {
  stalled: "ov.stalled", idle: "ov.idle", active: "ov.active", done: "ov.done",
};

// Міні-розкладка по статусах (без DONE — його показує прогрес-бар)
const OPEN_STATUSES = ["TODO", "IN_PROGRESS", "TO_REVIEW"] as const;

export default async function OverviewPage() {
  const user = await requireUser();
  const vectors = await getVectorsOverview(user.id, { all: isAdmin(user.role) });
  const sorted = [...vectors].sort(
    (a, b) => MOMENTUM_ORDER[a.momentum] - MOMENTUM_ORDER[b.momentum] || b.overdue - a.overdue || b.open - a.open,
  );

  const activeCount = vectors.filter((v) => v.momentum === "active").length;
  const stalledCount = vectors.filter((v) => v.momentum === "stalled").length;
  const doneWeek = vectors.reduce((s, v) => s + v.doneLast7, 0);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t(user.locale, "ov.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t(user.locale, "ov.sub")}</p>
        </div>
        <NewProjectDialog />
      </div>

      {/* Зведена смуга */}
      {vectors.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2 text-sm">
          <span className="rounded-lg border bg-card px-3 py-1.5">
            <b>{vectors.length}</b> {t(user.locale, "nav.projects").toLowerCase()}
          </span>
          <span className="rounded-lg border bg-card px-3 py-1.5">
            <b className="text-primary">{activeCount}</b> {t(user.locale, "ov.summaryActive")}
          </span>
          <span className={cn("rounded-lg border bg-card px-3 py-1.5", stalledCount > 0 && "border-destructive/40")}>
            <b className={cn(stalledCount > 0 && "text-destructive")}>{stalledCount}</b> {t(user.locale, "ov.summaryStalled")}
          </span>
          <span className="rounded-lg border bg-card px-3 py-1.5">
            <b>{doneWeek}</b> {t(user.locale, "ov.done").toLowerCase()} · {t(user.locale, "ov.doneWeek")}
          </span>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">{t(user.locale, "ov.empty")}</p>
          <div className="mt-4 flex justify-center"><NewProjectDialog /></div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((v) => (
            <VectorCard key={v.id} v={v} locale={user.locale} />
          ))}
        </div>
      )}
    </div>
  );
}

function VectorCard({ v, locale }: { v: VectorOverview; locale: string }) {
  return (
    <Link
      href={`/projects/${v.id}`}
      className={cn(
        "group flex flex-col rounded-xl border bg-card p-5 transition-all hover:shadow-md",
        v.momentum === "stalled" && "border-destructive/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: v.color }} />
          <h3 className="truncate font-medium group-hover:text-accent-foreground">{v.name}</h3>
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", MOMENTUM_STYLE[v.momentum])}>
          {t(locale, MOMENTUM_KEY[v.momentum])}
        </span>
      </div>

      {/* Прогрес */}
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>{v.done} {t(locale, "ov.of")} {v.total} {t(locale, "ov.tasks")}</span>
          <span className="font-medium">{v.progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${v.progress}%` }} />
        </div>
      </div>

      {/* Розкладка по відкритих статусах */}
      <div className="mt-3 flex flex-wrap gap-2">
        {OPEN_STATUSES.map((st) => {
          const n = v.counts[st];
          if (!n) return null;
          return (
            <span key={st} className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className={cn("size-2 rounded-full", TASK_STATUS_DOT[st])} />
              {n} {t(locale, `status.${st}`).toLowerCase()}
            </span>
          );
        })}
        {v.open === 0 && v.total > 0 && (
          <span className="text-[11px] text-muted-foreground">✓ {t(locale, "ov.done").toLowerCase()}</span>
        )}
      </div>

      {/* Час на вектор: тиждень / місяць */}
      <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-[11px]">
        <Clock className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="text-muted-foreground">{t(locale, "ov.week")}</span>
        <b className="text-foreground">{formatMinutes(v.weekMinutes, locale)}</b>
        <span className="mx-0.5 text-muted-foreground">·</span>
        <span className="text-muted-foreground">{t(locale, "ov.month")}</span>
        <b className="text-foreground">{formatMinutes(v.monthMinutes, locale)}</b>
      </div>

      {/* Підвал: динаміка */}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-[11px] text-muted-foreground">
        <span><b className="text-foreground">{v.doneLast7}</b> {t(locale, "ov.doneWeek")}</span>
        {v.createdLast7 > 0 && <span>+{v.createdLast7} {t(locale, "ov.newWeek")}</span>}
        {v.overdue > 0 && <span className="font-medium text-destructive">{v.overdue} {t(locale, "ov.overdue")}</span>}
        <span className="ml-auto">
          {v.lastDoneAt
            ? `${t(locale, "ov.lastDone")}: ${formatDate(v.lastDoneAt, locale)}`
            : t(locale, "ov.noActivity")}
        </span>
      </div>
    </Link>
  );
}
