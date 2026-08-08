"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, Check } from "lucide-react";
import { connectTelegram, disconnectTelegram } from "@/server/actions/telegram";
import { Button } from "@/components/ui/button";

export function TelegramCard({ configured, connected, username }: { configured: boolean; connected: boolean; username: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function connect() {
    start(async () => {
      const res = await connectTelegram();
      if (res.error || !res.url) { toast.error(res.error ?? "Помилка"); return; }
      window.open(res.url, "_blank");
      toast.success("Відкрийте Telegram і натисніть Start");
    });
  }

  return (
    <section className="mt-6 rounded-xl border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Send className="size-5 text-primary" />
        <div>
          <h2 className="text-sm font-semibold">Telegram-бот</h2>
          <p className="text-xs text-muted-foreground">Отримуйте сповіщення та керуйте задачами з телефона (/today, /inbox, /new…).</p>
        </div>
      </div>

      {!configured ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          Бота ще не налаштовано. Створіть бота у @BotFather і додайте <code>TELEGRAM_BOT_TOKEN</code> та <code>TELEGRAM_BOT_USERNAME</code> у <code>.env</code>, а вебхук — на <code>/api/telegram/webhook</code>.
        </p>
      ) : connected ? (
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm">
            <Check className="size-4 text-emerald-600" /> Підключено{username ? `: @${username}` : ""}
          </span>
          <Button variant="outline" disabled={pending} onClick={() => start(async () => { await disconnectTelegram(); toast.success("Відключено"); router.refresh(); })}>
            Відключити
          </Button>
        </div>
      ) : (
        <Button disabled={pending} onClick={connect}><Send className="size-4" /> Підключити Telegram</Button>
      )}
    </section>
  );
}
