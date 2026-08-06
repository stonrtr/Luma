"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { setNotificationSetting } from "@/server/actions/notification-settings";
import { Checkbox } from "@/components/ui/checkbox";
import { NOTIFICATION_TYPES } from "@/lib/notification-types";

export function NotificationSettingsForm({ settings }: { settings: Record<string, boolean> }) {
  const router = useRouter();
  const [, start] = useTransition();

  function toggle(type: string, enabled: boolean) {
    start(async () => {
      const res = await setNotificationSetting({ type, enabled });
      if (res?.error) toast.error(res.error);
      else { toast.success("Збережено"); router.refresh(); }
    });
  }

  return (
    <div className="divide-y rounded-xl border bg-card">
      {NOTIFICATION_TYPES.map((n) => {
        const enabled = settings[n.key] ?? true;
        return (
          <label key={n.key} className="flex cursor-pointer items-center gap-3 px-4 py-3">
            <Checkbox checked={enabled} onCheckedChange={(c) => toggle(n.key, !!c)} />
            <div className="flex flex-1 items-center gap-1.5">
              <div>
                <p className="text-sm font-medium">{n.label}</p>
                <p className="text-xs text-muted-foreground">{n.desc}</p>
              </div>
              <span
                className="group/info relative"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
              >
                <Info className="size-4 cursor-help text-muted-foreground/50 transition-colors hover:text-primary" />
                <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 hidden w-72 -translate-x-1/2 rounded-lg border bg-popover p-3 text-xs leading-relaxed text-popover-foreground shadow-lg group-hover/info:block">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Умова надсилання</span>
                  {n.condition}
                </span>
              </span>
            </div>
            <span className={enabled ? "text-xs font-medium text-emerald-600" : "text-xs text-muted-foreground"}>
              {enabled ? "Увімкнено" : "Вимкнено"}
            </span>
          </label>
        );
      })}
    </div>
  );
}
