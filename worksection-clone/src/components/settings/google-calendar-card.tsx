"use client";

import { useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, Check } from "lucide-react";
import { disconnectGoogle } from "@/server/actions/google";
import { Button } from "@/components/ui/button";

export function GoogleCalendarCard({ configured, connected, email }: { configured: boolean; connected: boolean; email: string | null }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  useEffect(() => {
    const s = params.get("google");
    if (!s) return;
    if (s === "connected") toast.success("Google Calendar підключено");
    else if (s === "error") toast.error("Не вдалося підключити Google Calendar");
    else if (s === "unconfigured") toast.error("Інтеграція Google не налаштована");
    // очистить query, чтобы тост не повторювався
    router.replace("/settings");
  }, [params, router]);

  return (
    <section className="mt-6 rounded-xl border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <CalendarDays className="size-5 text-primary" />
        <div>
          <h2 className="text-sm font-semibold">Google Calendar</h2>
          <p className="text-xs text-muted-foreground">Звінки з Google з’являться в календарі, а задачі зі стартом і дедлайном — у Google.</p>
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
            <Check className="size-4 text-emerald-600" /> Підключено{email ? `: ${email}` : ""}
          </span>
          <Button variant="outline" disabled={pending} onClick={() => start(async () => { await disconnectGoogle(); toast.success("Відключено"); router.refresh(); })}>
            Відключити
          </Button>
        </div>
      ) : (
        <Button asChild>
          <a href="/api/google/connect">Підключити Google Calendar</a>
        </Button>
      )}
    </section>
  );
}
