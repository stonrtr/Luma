import Link from "next/link";
import { ChevronLeft, ChevronRight, Phone } from "lucide-react";
import { requireUser } from "@/server/dal";
import { t } from "@/lib/i18n";
import { monthLabel } from "@/lib/week";
import { getCalendarData } from "@/server/queries/calendar";
import { NewCallDialog } from "@/components/calendar/new-call-dialog";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["1","2","3","4","5","6","7"];
const PALETTE = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#ef4444", "#14b8a6"];

function timeOf(d: Date) {
  return d.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string }> }) {
  const viewer = await requireUser();
  const now = new Date();
  const sp = await searchParams;
  const year = sp.y ? parseInt(sp.y) : now.getFullYear();
  const month = sp.m != null ? parseInt(sp.m) : now.getMonth();

  const { tasks, calls, users } = await getCalendarData(year, month);
  const isAdmin = viewer.role === "OWNER" || viewer.role === "ADMIN";
  const colorOf = new Map(users.map((u, i) => [u.id, PALETTE[i % PALETTE.length]]));

  type Entry = { day: number; sort: number; time: string | null; label: string; color: string; type: "task" | "call"; href?: string };
  const byDay = new Map<number, Entry[]>();
  const push = (e: Entry) => { const a = byDay.get(e.day) ?? []; a.push(e); byDay.set(e.day, a); };

  for (const t of tasks) {
    const d = t.scheduledAt ?? t.dueDate!;
    const uid = t.assignees[0]?.user.id;
    push({
      day: new Date(d).getDate(),
      sort: t.scheduledAt ? new Date(t.scheduledAt).getHours() * 60 + new Date(t.scheduledAt).getMinutes() : 9999,
      time: t.scheduledAt ? timeOf(new Date(t.scheduledAt)) : null,
      label: t.title,
      color: (uid && colorOf.get(uid)) || t.project?.color || "#64748b",
      type: "task",
      href: `/tasks/${t.id}`,
    });
  }
  for (const c of calls) {
    push({
      day: new Date(c.scheduledAt).getDate(),
      sort: new Date(c.scheduledAt).getHours() * 60 + new Date(c.scheduledAt).getMinutes(),
      time: timeOf(new Date(c.scheduledAt)),
      label: c.title,
      color: colorOf.get(c.user.id) || "#64748b",
      type: "call",
    });
  }
  for (const [, arr] of byDay) arr.sort((a, b) => a.sort - b.sort);

  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
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
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{monthLabel(month, viewer.locale)} {year}</h1>
        <div className="flex items-center gap-1">
          <Link href={`/calendar?y=${prev.y}&m=${prev.m}`} className="rounded-md border p-1.5 hover:bg-muted"><ChevronLeft className="size-4" /></Link>
          <Link href="/calendar" className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted">{t(viewer.locale, "cal.todayBtn")}</Link>
          <Link href={`/calendar?y=${next.y}&m=${next.m}`} className="rounded-md border p-1.5 hover:bg-muted"><ChevronRight className="size-4" /></Link>
        </div>
        <div className="ml-auto"><NewCallDialog users={users} canAssignOthers={isAdmin} selfId={viewer.id} /></div>
      </div>

      {/* Легенда сотрудников */}
      <div className="mb-4 flex flex-wrap gap-3">
        {users.map((u) => (
          <span key={u.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: colorOf.get(u.id) }} />{u.name}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-xl border bg-card">
        {WEEKDAYS.map((w) => (
          <div key={w} className="border-b border-r px-2 py-1.5 text-center text-xs font-medium text-muted-foreground last:border-r-0">{t(viewer.locale, `wd.${w}`)}</div>
        ))}
        {cells.map((day, i) => {
          const isToday = isThisMonth && day === now.getDate();
          const entries = day ? byDay.get(day) ?? [] : [];
          return (
            <div key={i} className={cn("min-h-28 border-b border-r p-1.5 last:border-r-0 [&:nth-child(7n)]:border-r-0", !day && "bg-muted/30")}>
              {day && (
                <>
                  <span className={cn("inline-flex size-6 items-center justify-center rounded-full text-xs", isToday ? "bg-primary font-medium text-primary-foreground" : "text-muted-foreground")}>{day}</span>
                  <div className="mt-1 space-y-1">
                    {entries.map((e, idx) => {
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
