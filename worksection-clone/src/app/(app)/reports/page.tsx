import Link from "next/link";
import { requireUser } from "@/server/dal";
import { getTimeReport } from "@/server/queries/reports";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatMinutes, formatMoney, formatDate, initials } from "@/lib/format";
import { Clock } from "lucide-react";

export default async function ReportsPage() {
  await requireUser();
  const report = await getTimeReport();
  const maxUser = Math.max(1, ...report.byUser.map((u) => u.minutes));
  const maxProject = Math.max(1, ...report.byProject.map((p) => p.minutes));
  const totalCost = report.byUser.reduce(
    (s, u) => s + (u.rate ? (u.minutes / 60) * u.rate : 0),
    0,
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Отчёты по времени</h1>
      <p className="mt-1 text-sm text-muted-foreground">Сводка учтённого времени по людям и проектам</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-2xl font-semibold">{formatMinutes(report.total)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Всего учтено</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-2xl font-semibold">{report.byUser.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Участников</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-2xl font-semibold">{formatMoney(totalCost)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Оценка стоимости</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold">По людям</h2>
          <div className="space-y-3">
            {report.byUser.map((u) => (
              <div key={u.name}>
                <div className="mb-1 flex items-center gap-2 text-sm">
                  <Avatar className="size-6"><AvatarFallback className="text-[9px]">{initials(u.name)}</AvatarFallback></Avatar>
                  <span className="flex-1">{u.name}</span>
                  <span className="font-medium">{formatMinutes(u.minutes)}</span>
                  {u.rate != null && (
                    <span className="w-20 text-right text-xs text-muted-foreground">
                      {formatMoney((u.minutes / 60) * u.rate)}
                    </span>
                  )}
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(u.minutes / maxUser) * 100}%` }} />
                </div>
              </div>
            ))}
            {report.byUser.length === 0 && <p className="text-sm text-muted-foreground">Нет данных.</p>}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold">По проектам</h2>
          <div className="space-y-3">
            {report.byProject.map((p) => (
              <div key={p.id}>
                <div className="mb-1 flex items-center gap-2 text-sm">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="flex-1">{p.name}</span>
                  <span className="font-medium">{formatMinutes(p.minutes)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${(p.minutes / maxProject) * 100}%`, backgroundColor: p.color }} />
                </div>
              </div>
            ))}
            {report.byProject.length === 0 && <p className="text-sm text-muted-foreground">Нет данных.</p>}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-xl border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold">Бюджеты проектов</h2>
        <div className="space-y-4">
          {report.byProject.map((p) => {
            const pct = p.budget ? Math.min(100, Math.round((p.cost / p.budget) * 100)) : 0;
            const over = p.budget != null && p.cost > p.budget;
            return (
              <div key={p.id}>
                <div className="mb-1 flex items-center gap-2 text-sm">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="flex-1">{p.name}</span>
                  <span className={over ? "font-medium text-destructive" : "font-medium"}>
                    {formatMoney(p.cost)}
                  </span>
                  <span className="text-muted-foreground">/ {formatMoney(p.budget)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${over ? "bg-destructive" : "bg-emerald-500"}`}
                    style={{ width: `${p.budget ? pct : 0}%` }}
                  />
                </div>
              </div>
            );
          })}
          {report.byProject.length === 0 && <p className="text-sm text-muted-foreground">Нет данных.</p>}
        </div>
      </section>

      <section className="mt-6 rounded-xl border bg-card p-5">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
          <Clock className="size-4" /> Последние записи
        </h2>
        <div className="divide-y">
          {report.logs.map((l) => (
            <div key={l.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="w-24 shrink-0 text-xs text-muted-foreground">{formatDate(l.loggedAt)}</span>
              <span className="w-32 shrink-0 truncate">{l.user.name}</span>
              <Link href={`/tasks/${l.taskId}`} className="flex-1 truncate hover:text-primary">
                {l.task.title}
              </Link>
              <span className="shrink-0 font-medium">{formatMinutes(l.minutes)}</span>
            </div>
          ))}
          {report.logs.length === 0 && <p className="py-2 text-sm text-muted-foreground">Пока нет записей времени.</p>}
        </div>
      </section>
    </div>
  );
}
