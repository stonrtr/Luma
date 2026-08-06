import Link from "next/link";
import { ChevronLeft, ChevronRight, Phone } from "lucide-react";
import { formatMinutes } from "@/lib/format";
import { cn } from "@/lib/utils";

export type WeekEvent = { startMin: number; endMin: number; title: string; color: string; type: "task" | "call"; href?: string; done?: boolean };
export type WeekAllDay = { title: string; color: string; href?: string; done?: boolean };
export type DaySummary = { freeMin: number; tasksDone: number; tasksPlanned: number; actualMin: number; plannedMin: number };
export type WeekDay = { dateLabel: string; weekdayLabel: string; isToday: boolean; events: WeekEvent[]; allDay: WeekAllDay[]; summary: DaySummary };
export type WeekData = { days: WeekDay[]; startHour: number; endHour: number; prevHref: string; nextHref: string; todayHref: string; title: string };

const HOUR_H = 48;

function hhmm(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function WeekCalendar({ data }: { data: WeekData }) {
  const { days, startHour, endHour } = data;
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  const totalH = (endHour - startHour) * HOUR_H;
  const hasAllDay = days.some((d) => d.allDay.length > 0);

  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        <div className="flex items-center gap-1">
          <Link href={data.prevHref} className="rounded-md border p-1.5 hover:bg-muted"><ChevronLeft className="size-4" /></Link>
          <Link href={data.todayHref} className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted">Сьогодні</Link>
          <Link href={data.nextHref} className="rounded-md border p-1.5 hover:bg-muted"><ChevronRight className="size-4" /></Link>
        </div>
        <span className="text-sm font-medium text-muted-foreground">{data.title}</span>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <div className="min-w-[720px]">
          {/* Заголовки дней */}
          <div className="grid border-b" style={{ gridTemplateColumns: "56px repeat(7, minmax(96px, 1fr))" }}>
            <div />
            {days.map((d, i) => (
              <div key={i} className={cn("border-l px-2 py-2 text-center", d.isToday && "bg-accent/40")}>
                <div className="text-xs text-muted-foreground">{d.weekdayLabel}</div>
                <div className={cn("text-sm font-medium", d.isToday && "text-primary")}>{d.dateLabel}</div>
              </div>
            ))}
          </div>

          {/* Весь день */}
          {hasAllDay && (
            <div className="grid border-b" style={{ gridTemplateColumns: "56px repeat(7, minmax(96px, 1fr))" }}>
              <div className="px-1 py-1 text-right text-[10px] text-muted-foreground">весь день</div>
              {days.map((d, i) => (
                <div key={i} className="space-y-1 border-l p-1">
                  {d.allDay.map((e, j) => {
                    const inner = <span className={cn("block truncate", e.done && "text-muted-foreground line-through")}>{e.title}</span>;
                    return e.href ? (
                      <Link key={j} href={e.href} className="block rounded px-1 py-0.5 text-[11px]" style={{ backgroundColor: `${e.color}22`, borderLeft: `2px solid ${e.color}` }} title={e.title}>{inner}</Link>
                    ) : (
                      <div key={j} className="rounded px-1 py-0.5 text-[11px]" style={{ backgroundColor: `${e.color}22`, borderLeft: `2px solid ${e.color}` }}>{inner}</div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Сетка часов */}
          <div className="grid" style={{ gridTemplateColumns: "56px repeat(7, minmax(96px, 1fr))" }}>
            {/* Гуттер времени */}
            <div className="relative" style={{ height: totalH }}>
              {hours.map((h, i) => (
                <div key={h} className="absolute right-1 -translate-y-1/2 text-[10px] text-muted-foreground" style={{ top: i * HOUR_H }}>{i < hours.length ? `${String(h).padStart(2, "0")}:00` : ""}</div>
              ))}
            </div>
            {/* Колонки дней */}
            {days.map((d, di) => (
              <div key={di} className={cn("relative border-l", d.isToday && "bg-accent/10")} style={{ height: totalH }}>
                {hours.map((_, i) => (
                  <div key={i} className="absolute inset-x-0 border-t border-border/50" style={{ top: i * HOUR_H }} />
                ))}
                {d.events.map((e, j) => {
                  const top = Math.max(0, ((e.startMin - startHour * 60) / 60) * HOUR_H);
                  const height = Math.max(20, ((e.endMin - e.startMin) / 60) * HOUR_H - 2);
                  const body = (
                    <>
                      <div className="flex items-center gap-1 truncate font-medium">
                        {e.type === "call" && <Phone className="size-2.5 shrink-0" />}
                        <span className={cn("truncate", e.done && "line-through opacity-70")}>{e.title}</span>
                      </div>
                      <div className="text-[9px] opacity-70">{hhmm(e.startMin)}–{hhmm(e.endMin)}</div>
                    </>
                  );
                  const cls = "absolute inset-x-1 overflow-hidden rounded-md px-1.5 py-0.5 text-[10px] leading-tight";
                  const st = { top, height, backgroundColor: `${e.color}26`, borderLeft: `3px solid ${e.color}` };
                  return e.href ? (
                    <Link key={j} href={e.href} className={cls} style={st} title={e.title}>{body}</Link>
                  ) : (
                    <div key={j} className={cls} style={st} title={e.title}>{body}</div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Итоги по дню */}
          <div className="grid border-t bg-muted/30" style={{ gridTemplateColumns: "56px repeat(7, minmax(96px, 1fr))" }}>
            <div className="flex items-center justify-center text-muted-foreground">Σ</div>
            {days.map((s, i) => (
              <div key={i} className="space-y-1 border-l p-2 text-[11px]">
                <div>
                  <span className="text-muted-foreground">Вільний час</span>
                  <div className="font-medium">{formatMinutes(Math.max(0, s.summary.freeMin))}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Задач</span>
                  <div className="font-medium">{s.summary.tasksDone} / {s.summary.tasksPlanned}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Факт / План</span>
                  <div className="font-medium">{formatMinutes(s.summary.actualMin)} / {formatMinutes(s.summary.plannedMin)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
