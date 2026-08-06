import Link from "next/link";
import { ChevronLeft, ChevronRight, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTH_NAMES = ["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"];
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

export type CalEntry = { day: number; sort: number; time: string | null; label: string; color: string; type: "task" | "call"; href?: string };

export function MonthCalendar({
  year, month, entries, prevHref, nextHref, todayHref, title,
}: {
  year: number; month: number; entries: CalEntry[];
  prevHref: string; nextHref: string; todayHref: string; title?: boolean;
}) {
  const now = new Date();
  const byDay = new Map<number, CalEntry[]>();
  for (const e of entries) { const a = byDay.get(e.day) ?? []; a.push(e); byDay.set(e.day, a); }
  for (const [, arr] of byDay) arr.sort((a, b) => a.sort - b.sort);

  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const isThisMonth = year === now.getFullYear() && month === now.getMonth();

  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        {title && <h2 className="text-lg font-semibold">{MONTH_NAMES[month]} {year}</h2>}
        <div className="flex items-center gap-1">
          <Link href={prevHref} className="rounded-md border p-1.5 hover:bg-muted"><ChevronLeft className="size-4" /></Link>
          <Link href={todayHref} className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted">Сьогодні</Link>
          <Link href={nextHref} className="rounded-md border p-1.5 hover:bg-muted"><ChevronRight className="size-4" /></Link>
        </div>
        {!title && <span className="text-sm font-medium text-muted-foreground">{MONTH_NAMES[month]} {year}</span>}
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-xl border bg-card">
        {WEEKDAYS.map((w) => (
          <div key={w} className="border-b border-r px-2 py-1.5 text-center text-xs font-medium text-muted-foreground last:border-r-0">{w}</div>
        ))}
        {cells.map((day, i) => {
          const isToday = isThisMonth && day === now.getDate();
          const dayEntries = day ? byDay.get(day) ?? [] : [];
          return (
            <div key={i} className={cn("min-h-28 border-b border-r p-1.5 last:border-r-0 [&:nth-child(7n)]:border-r-0", !day && "bg-muted/30")}>
              {day && (
                <>
                  <span className={cn("inline-flex size-6 items-center justify-center rounded-full text-xs", isToday ? "bg-primary font-medium text-primary-foreground" : "text-muted-foreground")}>{day}</span>
                  <div className="mt-1 space-y-1">
                    {dayEntries.map((e, idx) => {
                      const inner = (
                        <span className="flex items-center gap-1 truncate">
                          <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
                          {e.type === "call" && <Phone className="size-2.5 shrink-0" />}
                          {e.time && <span className="shrink-0 tabular-nums text-muted-foreground">{e.time}</span>}
                          <span className="truncate">{e.label}</span>
                        </span>
                      );
                      return e.href ? (
                        <Link key={idx} href={e.href} className="block rounded px-1 py-0.5 text-[11px] hover:bg-muted" title={e.label}>{inner}</Link>
                      ) : (
                        <div key={idx} className="rounded px-1 py-0.5 text-[11px]" title={e.label}>{inner}</div>
                      );
                    })}
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
