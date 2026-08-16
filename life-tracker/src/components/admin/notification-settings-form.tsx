"use client";
import { useT } from "@/lib/locale-context";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Info, Bell, Send } from "lucide-react";
import { setNotificationSetting } from "@/server/actions/notification-settings";
import { Checkbox } from "@/components/ui/checkbox";
import { NOTIFICATION_TYPES } from "@/lib/notification-types";
import type { NotifChannels } from "@/server/queries/notification-settings";

export function NotificationSettingsForm({ settings }: { settings: Record<string, NotifChannels> }) {
  const router = useRouter();
  const [, start] = useTransition();
  const tr = useT();

  function toggle(type: string, channel: "push" | "telegram", enabled: boolean) {
    start(async () => {
      const res = await setNotificationSetting({ type, channel, enabled });
      if (res?.error) toast.error(res.error);
      else { toast.success(tr("common.saved")); router.refresh(); }
    });
  }

  return (
    <div className="divide-y rounded-xl border bg-card">
      {NOTIFICATION_TYPES.map((n) => {
        const ch = settings[n.key] ?? { push: true, telegram: true };
        return (
          <div key={n.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">{tr(`ntype.${n.key}.label`)}</p>
                <p className="text-xs text-muted-foreground">{tr(`ntype.${n.key}.desc`)}</p>
              </div>
              <span className="group/info relative shrink-0">
                <Info className="size-4 cursor-help text-muted-foreground/50 transition-colors hover:text-accent-foreground" />
                <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 hidden w-72 -translate-x-1/2 rounded-lg border bg-popover p-3 text-xs leading-relaxed text-popover-foreground shadow-lg group-hover/info:block">
                  <span className="mb-1 block text-[10px] font-semibold text-muted-foreground">{tr("nset.condition")}</span>
                  {tr(`ntype.${n.key}.cond`)}
                </span>
              </span>
            </div>
            {/* Два канала: пуш в приложении и Telegram */}
            <div className="flex shrink-0 items-center gap-4">
              <label className="flex cursor-pointer items-center gap-1.5 text-xs" title={tr("nset.pushCh")}>
                <Checkbox checked={ch.push} onCheckedChange={(c) => toggle(n.key, "push", !!c)} />
                <Bell className="size-3.5 text-muted-foreground" />
                <span className="hidden sm:inline">{tr("nset.pushCh")}</span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs" title={tr("nset.tgCh")}>
                <Checkbox checked={ch.telegram} onCheckedChange={(c) => toggle(n.key, "telegram", !!c)} />
                <Send className="size-3.5 text-muted-foreground" />
                <span className="hidden sm:inline">{tr("nset.tgCh")}</span>
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
}
