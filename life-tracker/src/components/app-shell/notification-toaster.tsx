"use client";
import { useT } from "@/lib/locale-context";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Notif = { id: string; type: string; message: string; link: string | null; readAt: string | null };

// Показывает всплывающие пуши (снизу справа) для новых уведомлений — один раз за сессию
export function NotificationToaster({ items }: { items: Notif[] }) {
  const router = useRouter();
  const tr = useT();

  useEffect(() => {
    const KEY = "ws_shown_notifs";
    let shown: string[] = [];
    try { shown = JSON.parse(sessionStorage.getItem(KEY) || "[]"); } catch { shown = []; }
    const shownSet = new Set(shown);

    const fresh = items.filter(
      (n) => !n.readAt && ["assignment", "overdue", "review"].includes(n.type) && !shownSet.has(n.id),
    );

    for (const n of fresh) {
      const opts = n.link
        ? { action: { label: tr("notif.open"), onClick: () => router.push(n.link!) } }
        : undefined;
      if (n.type === "overdue") toast.error(n.message, opts);
      else toast.info(n.message, opts);
      shownSet.add(n.id);
    }
    if (fresh.length) {
      try { sessionStorage.setItem(KEY, JSON.stringify([...shownSet].slice(-100))); } catch {}
    }
  }, [items, router]);

  return null;
}
