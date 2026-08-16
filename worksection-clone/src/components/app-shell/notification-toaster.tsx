"use client";
import { useT } from "@/lib/locale-context";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Notif = { id: string; type: string; message: string; link: string | null; readAt: string | null; createdAt: string };

const POLL_MS = 12000; // как часто опрашивать сервер о новых пушах

// Карточка пуша — вся кликабельна: по клику открывает задачу (n.link).
function NotifCard({ n, title, onOpen, onClose }: {
  n: Notif; title: string | null; onOpen: () => void; onClose: () => void;
}) {
  const overdue = n.type === "overdue";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      className={cn(
        "relative flex w-[360px] max-w-[calc(100vw-2rem)] cursor-pointer flex-col gap-0.5 rounded-2xl border p-4 pr-9 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.28)] transition-colors",
        overdue
          ? "border-red-300 bg-red-50 hover:bg-red-100/70 dark:border-red-900/60 dark:bg-red-950/30 dark:hover:bg-red-950/50"
          : "border-black/5 bg-card hover:bg-muted/50 dark:border-white/10",
      )}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Close"
        className="absolute right-2.5 top-2.5 grid size-6 place-items-center rounded-md text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
      {title && <p className="text-[13px] font-semibold leading-5 text-foreground">{title}</p>}
      <p className="whitespace-pre-line text-[13px] leading-snug text-muted-foreground">{n.message}</p>
    </div>
  );
}

// Живой тостер пушей «в приложении»: опрашивает сервер, показывает всплывашки снизу справа
// (держатся, пока их не скроют) и проигрывает звук на каждый новый пуш.
export function NotificationToaster({ items }: { items: Notif[] }) {
  const router = useRouter();
  const tr = useT();

  const shown = useRef<Set<string>>(new Set(items.map((n) => n.id))); // уже показанные — стартово всё из SSR (бэклог не спамим)
  const audio = useRef<HTMLAudioElement | null>(null);

  // Разблокировка звука после первого жеста пользователя (политика автоплея).
  // capture:true — ловим жест раньше любого stopPropagation в UI.
  useEffect(() => {
    const el = new Audio("/notify.mp3");
    el.preload = "auto";
    el.volume = 1;
    audio.current = el;
    const unlock = () => {
      el.muted = true;
      el.play().then(() => { el.pause(); el.currentTime = 0; el.muted = false; }).catch(() => { el.muted = false; });
    };
    const opts = { capture: true } as const;
    window.addEventListener("pointerdown", unlock, opts);
    window.addEventListener("keydown", unlock, opts);
    window.addEventListener("click", unlock, opts);
    window.addEventListener("touchstart", unlock, opts);
    return () => {
      window.removeEventListener("pointerdown", unlock, opts);
      window.removeEventListener("keydown", unlock, opts);
      window.removeEventListener("click", unlock, opts);
      window.removeEventListener("touchstart", unlock, opts);
    };
  }, []);

  // Проигрываем звук. Клонируем узел — чтобы пуши подряд не обрывали друг друга.
  function ding() {
    const base = audio.current;
    if (!base) return;
    const el = base.cloneNode(true) as HTMLAudioElement;
    el.volume = 1;
    el.muted = false;
    el.play().catch(() => { /* автоплей ещё не разрешён браузером — тихо */ });
  }

  function push(n: Notif) {
    ding();
    const label = tr(`ntype.${n.type}.label`);
    // Вечірній підсумок (overdue) — без заголовка картки: текст говорить сам за себе
    const title = n.type === "overdue" ? null : (label.startsWith("ntype.") ? tr("notif.title") : label);
    toast.custom(
      (id) => (
        <NotifCard
          n={n}
          title={title}
          onOpen={() => { if (n.link) router.push(n.link); toast.dismiss(id); }}
          onClose={() => toast.dismiss(id)}
        />
      ),
      { duration: Infinity, unstyled: true }, // держится, пока не скроют; unstyled — рисуем свою карточку
    );
  }

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/notifications/recent", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { items: Notif[] };
        const fresh = data.items.filter((n) => !n.readAt && !shown.current.has(n.id)).reverse();
        for (const n of fresh) {
          shown.current.add(n.id);
          push(n);
        }
        // счётчик колокола обновляем мягко — событием, без router.refresh()
        window.dispatchEvent(new CustomEvent("ws:notif-unread", { detail: data.items.filter((n) => !n.readAt).length }));
      } catch { /* сеть/оффлайн — молча повторим */ }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    const onFocus = () => poll();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, tr]);

  return null;
}
