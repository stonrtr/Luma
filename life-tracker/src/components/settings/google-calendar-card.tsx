"use client";
import { useT } from "@/lib/locale-context";

import { useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, Check } from "lucide-react";
import { disconnectGoogle } from "@/server/actions/google";
import { Button } from "@/components/ui/button";

export function GoogleCalendarCard({ configured, connected, email }: { configured: boolean; connected: boolean; email: string | null }) {
  const router = useRouter();
  const tr = useT();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  useEffect(() => {
    const s = params.get("google");
    if (!s) return;
    if (s === "connected") toast.success(tr("gc.connectedMsg"));
    else if (s === "error") toast.error(tr("gc.failed"));
    else if (s === "unconfigured") toast.error(tr("gc.notConfigured"));
    // очистить query, чтобы тост не повторювався
    router.replace("/settings");
  }, [params, router]);

  return (
    <section className="mt-6 rounded-xl border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <CalendarDays className="size-5 text-accent-foreground" />
        <div>
          <h2 className="text-sm font-semibold">Google Calendar</h2>
          <p className="text-xs text-muted-foreground">{tr("gc.desc")}</p>
        </div>
      </div>

      {!configured ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          Інтеграцію ще не налаштовано. Додайте <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code> та <code>APP_URL</code> у <code>.env</code>,
          а в Google Cloud Console дозвольте redirect URI <code>/api/google/callback</code>.
        </p>
      ) : connected ? (
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm">
            <Check className="size-4 text-[#3D6B26] dark:text-[#A9D97F]" /> {tr("tg.connected")}{email ? `: ${email}` : ""}
          </span>
          <Button variant="outline" disabled={pending} onClick={() => start(async () => { await disconnectGoogle(); toast.success(tr("tg.disconnected")); router.refresh(); })}>
            {tr("tg.disconnect")}
          </Button>
        </div>
      ) : (
        <Button asChild>
          <a href="/api/google/connect">{tr("gc.connect")}</a>
        </Button>
      )}
    </section>
  );
}
