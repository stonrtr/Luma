"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Phone } from "lucide-react";
import { NewTaskDialog } from "@/components/board/new-task-dialog";
import { formatMinutes } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type WeekEvent = { startMin: number; endMin: number; title: string; color: string; type: "task" | "call"; href?: string; done?: boolean };
export type WeekAllDay = { title: string; color: string; href?: string; done?: boolean };
export type DaySummary = { freeMin: number; tasksDone: number; tasksPlanned: number; actualMin: number; plannedMin: number };
export type WeekDay = { dateISO?: string; dateLabel: string; weekdayLabel: string; isToday: boolean; events: WeekEvent[]; allDay: WeekAllDay[]; summary: DaySummary };
export type WeekData = { days: WeekDay[]; startHour: number; endHour: number; prevHref: string; nextHref: string; todayHref: string; title: string };

const HOUR_H = 48;

function hhmm(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function WeekCalendar({ data, locale = "uk", ownerId }: { data: WeekData; locale?: string; ownerId?: string }) {
  const { days, startHour, endHour } = data;
  // Клик по пустому слоту → новая задача со стартом в этом слоте (снап к 30 хв)
  const [slot, setSlot] = useState<{ date: string; time: string } | null>(null);
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  const totalH = (endHour - startHour) * HOUR_H;
  const hasAllDay = days.some((d) => d.allDay.length > 0);

  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        <div className="flex items-center gap-1">
          <Link href={data.prevHref} className="rounded-md border p-1.5 hover:bg-muted"><ChevronLeft className="size-4" /></Link>
          <Link href={data.todayHref} className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted">{t(locale, "cal.today")}</Link>
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
                <div className={cn("text-sm font-medium", d.isToday && "text-accent-foreground")}>{d.dateLabel}</div>
              </div>
            ))}
          </div>

          {/* Весь день */}
          {hasAllDay && (
            <div className="grid border-b" style={{ gridTemplateColumns: "56px repeat(7, minmax(96px, 1fr))" }}>
              <div className="px-1 py-1 text-right text-[10px] text-muted-foreground">{t(locale, "cal.allDay")}</div>
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
              <div
                key={di}
                className={cn("relative border-l", d.isToday && "bg-accent/10", ownerId && d.dateISO && "cursor-pointer")}
                style={{ height: totalH }}
                onClick={(e) => {
                  if (!ownerId || !d.dateISO) return;
                  if ((e.target as HTMLElement).closest("a")) return; // клик по событию — не создаём
                  const rect = e.currentTarget.getBoundingClientRect();
                  const half = Math.floor((e.clientY - rect.top) / (HOUR_H / 2));
                  const mins = Math.min(startHour * 60 + half * 30, endHour * 60 - 30);
                  setSlot({ date: d.dateISO, time: hhmm(mins) });
                }}
              >
                {hours.map((_, i) => (
                  <div key={i} className="absolute inset-x-0 border-t border-border/50" style={{ top: i * HOUR_H }} />
                ))}
                {d.events.map((e, j) => {
                  const top = Math.max(0, ((e.startMin - startHour * 60) / 60) * HOUR_H);
                  const height = Math.max(20, ((e.endMin - e.startMin) / 60) * HOUR_H - 2);
                  // Високий блок (≥42px) — назва переноситься на 2 рядки; інакше — одна з «…».
                  const tall = height >= 42;
                  const body = tall ? (
                    <>
                      <div className="flex items-start gap-1 font-medium">
                        {e.type === "call" && <Phone className="mt-[2px] size-2.5 shrink-0" />}
                        <span className={cn("line-clamp-2 break-words whitespace-normal", e.done && "line-through opacity-70")}>{e.title}</span>
                      </div>
                      <div className="text-[9px] opacity-70">{hhmm(e.startMin)}–{hhmm(e.endMin)}</div>
                    </>
                  ) : (
                    // Низький блок: назва і час в ОДНОМУ рядку; довга назва — «…», час тоді в тултіпі
                    <div className="truncate">
                      {e.type === "call" && <Phone className="mr-0.5 inline size-2.5 align-[-1px]" />}
                      <span className={cn("font-medium", e.done && "line-through opacity-70")}>{e.title}</span>
                      <span className="ml-1 text-[9px] opacity-70">{hhmm(e.startMin)}–{hhmm(e.endMin)}</span>
                    </div>
                  );
                  const cls = "absolute inset-x-1 overflow-hidden rounded-md px-1.5 py-0.5 text-[10px] leading-tight";
                  const st = { top, height, backgroundColor: `${e.color}26`, borderLeft: `3px solid ${e.color}` };
                  const tip = `${e.title} · ${hhmm(e.startMin)}–${hhmm(e.endMin)}`; // повна назва + час у тултіпі
                  return e.href ? (
                    <Link key={j} href={e.href} className={cls} style={st} title={tip}>{body}</Link>
                  ) : (
                    <div key={j} className={cls} style={st} title={tip}>{body}</div>
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
                  <span className="text-muted-foreground">{t(locale, "cal.freeTime")}</span>
                  <div className="font-medium">{formatMinutes(Math.max(0, s.summary.freeMin), locale)}</div>
                </div>

              </div>
            ))}
          </div>
        </div>
      </div>

      {ownerId && slot && (
        <NewTaskDialog
          key={`${slot.date}T${slot.time}`}
          projectId=""
          members={[]}
          status="TODO"
          onClose={() => setSlot(null)}
          lockedAssigneeId={ownerId}
          initialStartDate={slot.date}
          initialStartTime={slot.time}
          initialDueDate={slot.date}
          locale={locale}
        />
      )}
    </div>
  );
}
