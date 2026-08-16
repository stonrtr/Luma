"use client";

import { useEffect, useState, useTransition } from "react";
import { useT } from "@/lib/locale-context";
import { useRouter } from "next/navigation";
import { Bell, Check } from "lucide-react";
import { markAllNotificationsRead, markNotificationRead } from "@/server/actions/notifications";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Notif = {
  id: string;
  message: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationBell({ items, unread }: { items: Notif[]; unread: number }) {
  const router = useRouter();
  const [, start] = useTransition();
  const tr = useT();
  const [open, setOpen] = useState(false);

  // Живой счётчик: тостер шлёт ws:notif-unread при поллинге новых пушей
  const [liveUnread, setLiveUnread] = useState(unread);
  useEffect(() => setLiveUnread(unread), [unread]);
  useEffect(() => {
    const on = (e: Event) => setLiveUnread((e as CustomEvent<number>).detail);
    window.addEventListener("ws:notif-unread", on);
    return () => window.removeEventListener("ws:notif-unread", on);
  }, []);

  // Живой список: при каждом открытии подтягиваем свежие уведомления —
  // пуши видны без перезагрузки страницы (серверный рендер — только стартовое состояние).
  const [list, setList] = useState<Notif[]>(items);
  useEffect(() => setList(items), [items]);
  const refresh = async () => {
    try {
      const res = await fetch("/api/notifications/recent", { cache: "no-store" });
      if (!res.ok) return;
      const data: { items: Notif[]; unread: number } = await res.json();
      setList(data.items);
      setLiveUnread(data.items.filter((n) => !n.readAt).length);
    } catch { /* сеть моргнула — покажем что есть */ }
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) refresh(); }}>
      <PopoverTrigger className="relative flex size-8 items-center justify-center rounded-md hover:bg-muted">
        <Bell className="size-4 text-muted-foreground" />
        {liveUnread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-medium text-white">
            {liveUnread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">{tr("notif.title")}</span>
          {liveUnread > 0 && (
            <button
              onClick={() => start(async () => { await markAllNotificationsRead(); setLiveUnread(0); router.refresh(); })}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Check className="size-3" /> {tr("notif.readAll")}
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {list.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{tr("notif.empty")}</p>
          )}
          {list.map((n) => {
            const body = (
              <div className="flex items-start gap-2">
                <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} />
                <div className="min-w-0">
                  <p className={cn("whitespace-pre-line text-sm", !n.readAt && "font-medium")}>{n.message}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(n.createdAt)}</p>
                </div>
              </div>
            );
            // Уведомление о конкретной задаче (назначение, «на перевірку», коментар…)
            // ведёт на неё; дайджесты и сводки — только для чтения.
            const taskLink = n.link?.startsWith("/tasks/") ? n.link : null;
            if (taskLink) {
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    start(async () => {
                      if (!n.readAt) { await markNotificationRead(n.id); setLiveUnread((u) => Math.max(0, u - 1)); }
                      router.push(taskLink);
                    });
                  }}
                  className="block w-full border-b px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-muted/60"
                >
                  {body}
                </button>
              );
            }
            return (
              <div key={n.id} className="border-b px-3 py-2 last:border-b-0">
                {body}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
