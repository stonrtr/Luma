import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireUser } from "@/server/dal";
import { getCalendarTasks } from "@/server/queries/reports";
import { TASK_STATUS_DOT } from "@/lib/domain";
import { isOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const user = await requireUser();
  const now = new Date();
  const sp = await searchParams;
  const year = sp.y ? parseInt(sp.y) : now.getFullYear();
  const month = sp.m != null ? parseInt(sp.m) : now.getMonth();

  const tasks = await getCalendarTasks(user.id, year, month);
  const byDay = new Map<number, typeof tasks>();
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const day = new Date(t.dueDate).getDate();
    const arr = byDay.get(day) ?? [];
    arr.push(t);
    byDay.set(day, arr);
  }

  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Пн = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const prev = month === 0 ? { y: year - 1, m: 11 } : { y: year, m: month - 1 };
  const next = month === 11 ? { y: year + 1, m: 0 } : { y: year, m: month + 1 };
  const isThisMonth = year === now.getFullYear() && month === now.getMonth();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {MONTH_NAMES[month]} {year}
        </h1>
        <div className="flex items-center gap-1">
          <Link href={`/calendar?y=${prev.y}&m=${prev.m}`} className="rounded-md border p-1.5 hover:bg-muted">
            <ChevronLeft className="size-4" />
          </Link>
          <Link href="/calendar" className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted">
            Сегодня
          </Link>
          <Link href={`/calendar?y=${next.y}&m=${next.m}`} className="rounded-md border p-1.5 hover:bg-muted">
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-xl border bg-card">
        {WEEKDAYS.map((w) => (
          <div key={w} className="border-b border-r px-2 py-1.5 text-center text-xs font-medium text-muted-foreground last:border-r-0">
            {w}
          </div>
        ))}
        {cells.map((day, i) => {
          const isToday = isThisMonth && day === now.getDate();
          const dayTasks = day ? byDay.get(day) ?? [] : [];
          return (
            <div
              key={i}
              className={cn(
                "min-h-24 border-b border-r p-1.5 last:border-r-0 [&:nth-child(7n)]:border-r-0",
                !day && "bg-muted/30",
              )}
            >
              {day && (
                <>
                  <span
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded-full text-xs",
                      isToday ? "bg-primary font-medium text-primary-foreground" : "text-muted-foreground",
                    )}
                  >
                    {day}
                  </span>
                  <div className="mt-1 space-y-1">
                    {dayTasks.map((t) => (
                      <Link
                        key={t.id}
                        href={`/tasks/${t.id}`}
                        className="flex items-center gap-1 rounded px-1 py-0.5 text-[11px] hover:bg-muted"
                        title={t.title}
                      >
                        <span className={cn("size-1.5 shrink-0 rounded-full", TASK_STATUS_DOT[t.status])} />
                        <span
                          className={cn(
                            "truncate",
                            isOverdue(t.dueDate) && t.status !== "DONE" && "text-destructive",
                          )}
                        >
                          {t.title}
                        </span>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
