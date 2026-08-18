"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useT } from "@/lib/locale-context";
import { useRouter } from "next/navigation";
import { Bell, Check } from "lucide-react";
import { markNotificationRead, markAllNotificationsRead } from "@/server/actions/notifications";
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

  return (
    <Popover>
      <PopoverTrigger className="relative flex size-8 items-center justify-center rounded-md hover:bg-muted">
        <Bell className="size-4 text-muted-foreground" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-medium text-white">
            {unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">{tr("notif.title")}</span>
          {unread > 0 && (
            <button
              onClick={() => start(async () => { await markAllNotificationsRead(); router.refresh(); })}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Check className="size-3" /> {tr("notif.readAll")}
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{tr("notif.empty")}</p>
          )}
          {items.map((n) => {
            const body = (
              <div className="flex items-start gap-2">
                <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} />
                <div className="min-w-0">
                  <p className={cn("text-sm", !n.readAt && "font-medium")}>{n.message}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(n.createdAt)}</p>
                </div>
              </div>
            );
            const onClick = () => {
              if (!n.readAt) start(async () => { await markNotificationRead(n.id); router.refresh(); });
            };
            return n.link ? (
              <Link key={n.id} href={n.link} onClick={onClick} className="block border-b px-3 py-2 last:border-b-0 hover:bg-muted/50">
                {body}
              </Link>
            ) : (
              <div key={n.id} onClick={onClick} className="cursor-pointer border-b px-3 py-2 last:border-b-0 hover:bg-muted/50">
                {body}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
