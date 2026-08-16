"use client";
import { useT } from "@/lib/locale-context";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Info, Bell, Send, Clock, CalendarDays, Zap } from "lucide-react";
import { updateNotificationSetting } from "@/server/actions/notification-settings";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NOTIFICATION_TYPES } from "@/lib/notification-types";
import type { NotifConfig } from "@/server/queries/notification-settings";
import { cn } from "@/lib/utils";

const toTime = (m: number | null) => (m == null ? "" : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
const toMinutes = (v: string): number | null => {
  const [h, m] = v.split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

export function NotificationHub({ settings }: { settings: Record<string, NotifConfig> }) {
  const router = useRouter();
  const tr = useT();
  const [pending, start] = useTransition();

  function save(type: string, patch: Partial<{ enabled: boolean; push: boolean; telegram: boolean; sendAtMinutes: number | null; weekdaysOnly: boolean }>) {
    start(async () => {
      const res = await updateNotificationSetting({ type, ...patch });
      if (res?.error) toast.error(res.error);
      else { toast.success(tr("common.saved")); router.refresh(); }
    });
  }

  const events = NOTIFICATION_TYPES.filter((t) => !t.scheduled);
  const scheduled = NOTIFICATION_TYPES.filter((t) => t.scheduled);

  function Row({ typeKey, scheduled }: { typeKey: string; scheduled: boolean }) {
    const c = settings[typeKey] ?? { enabled: true, push: true, telegram: true, sendAtMinutes: null, weekdaysOnly: true };
    return (
      <div className={cn("px-4 py-3", !c.enabled && "opacity-60")}>
        <div className="flex flex-wrap items-center gap-3">
          {/* Мастер вкл/выкл + название */}
          <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5">
            <Checkbox className="mt-0.5" checked={c.enabled} onCheckedChange={(v) => save(typeKey, { enabled: !!v })} disabled={pending} />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {tr(`ntype.${typeKey}.label`)}
                <span className="group/i relative">
                  <Info className="size-3.5 cursor-help text-muted-foreground/50 hover:text-accent-foreground" />
                  <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 hidden w-72 -translate-x-1/2 rounded-lg border bg-popover p-3 text-xs leading-relaxed text-popover-foreground shadow-lg group-hover/i:block">
                    <span className="mb-1 block text-[10px] font-semibold text-muted-foreground">{tr("nset.condition")}</span>
                    {tr(`ntype.${typeKey}.cond`)}
                  </span>
                </span>
              </span>
              <span className="block text-xs text-muted-foreground">{tr(`ntype.${typeKey}.desc`)}</span>
            </span>
          </label>

          {/* Каналы */}
          <div className="flex shrink-0 items-center gap-3">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs" title={tr("nset.pushCh")}>
              <Checkbox checked={c.push} disabled={!c.enabled || pending} onCheckedChange={(v) => save(typeKey, { push: !!v })} />
              <Bell className="size-3.5 text-muted-foreground" /><span className="hidden sm:inline">{tr("nset.pushCh")}</span>
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs" title={tr("nset.tgCh")}>
              <Checkbox checked={c.telegram} disabled={!c.enabled || pending} onCheckedChange={(v) => save(typeKey, { telegram: !!v })} />
              <Send className="size-3.5 text-muted-foreground" /><span className="hidden sm:inline">{tr("nset.tgCh")}</span>
            </label>
          </div>
        </div>

        {/* Когда / условия — только для плановых */}
        {scheduled ? (
          <div className="mt-2 flex flex-wrap items-center gap-4 pl-7 text-xs">
            <label className="flex items-center gap-1.5">
              <Clock className="size-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">{tr("nset.timeLabel")}</span>
              <Input type="time" className="h-7 w-[6.5rem]" defaultValue={toTime(c.sendAtMinutes)} disabled={!c.enabled || pending}
                onChange={(e) => { const m = toMinutes(e.target.value); if (m != null && m !== c.sendAtMinutes) save(typeKey, { sendAtMinutes: m }); }} />
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <Checkbox checked={c.weekdaysOnly} disabled={!c.enabled || pending} onCheckedChange={(v) => save(typeKey, { weekdaysOnly: !!v })} />
              <CalendarDays className="size-3.5 text-muted-foreground" />
              <span>{tr("nset.weekdaysOnly")}</span>
            </label>
          </div>
        ) : (
          <div className="mt-1 flex items-center gap-1.5 pl-7 text-[11px] text-muted-foreground">
            <Zap className="size-3" /> {tr("nset.instant")}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{tr("nset.eventGroup")}</h2>
        <div className="divide-y rounded-xl border bg-card">
          {events.map((t) => <Row key={t.key} typeKey={t.key} scheduled={false} />)}
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{tr("nset.schedGroup")}</h2>
        <div className="divide-y rounded-xl border bg-card">
          {scheduled.map((t) => <Row key={t.key} typeKey={t.key} scheduled={true} />)}
        </div>
      </section>
    </div>
  );
}
