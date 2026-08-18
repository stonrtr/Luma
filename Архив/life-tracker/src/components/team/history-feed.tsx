import Link from "next/link";
import { History } from "lucide-react";
import { t } from "@/lib/i18n";
import type { TaskStatus } from "@/generated/prisma/enums";

const BCP: Record<string, string> = { uk: "uk-UA", ru: "ru-RU", en: "en-US" };

export type HistoryItem = {
  id: string; type: string; actorName: string;
  taskId: string | null; meta: string | null; createdAt: string;
};

function relTime(iso: string, locale: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t(locale, "hf.justNow");
  if (m < 60) return `${m} ${t(locale, "hf.minAgo")}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${t(locale, "hf.hourAgo")}`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} ${t(locale, "hf.dayAgo")}`;
  return new Date(iso).toLocaleDateString(BCP[locale] ?? "uk-UA", { day: "2-digit", month: "short" });
}

function describe(item: HistoryItem, locale: string): { text: string; title: string | null } {
  if (item.type === "task.created") {
    return { text: t(locale, "hf.createdTask"), title: item.meta };
  }
  if (item.type === "comment.added") {
    return { text: t(locale, "hf.commented"), title: item.meta };
  }
  if (item.type === "task.status") {
    try {
      const m = JSON.parse(item.meta ?? "{}") as { title?: string; to?: TaskStatus };
      const VERB: Record<TaskStatus, string> = {
        DONE: t(locale, "hf.done"),
        TO_REVIEW: t(locale, "hf.toReview"),
        IN_PROGRESS: t(locale, "hf.inProgress"),
        TODO: t(locale, "hf.todo"),
        IDEA: t(locale, "hf.idea"),
      };
      const verb = m.to ? VERB[m.to] : t(locale, "hf.changedStatus");
      return { text: verb, title: m.title ?? null };
    } catch {
      return { text: t(locale, "hf.changedStatus"), title: null };
    }
  }
  return { text: item.type, title: item.meta };
}

// История действий команды: создание задач, смены статусов, закрытия
export function HistoryFeed({ items, locale = "uk" }: { items: HistoryItem[]; locale?: string }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
        <History className="size-4 text-muted-foreground" /> {t(locale, "hf.header")}
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t(locale, "hf.noActivity")}</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {items.map((it) => {
            const d = describe(it, locale);
            return (
              <li key={it.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                <span className="font-medium">{it.actorName}</span>
                <span className="text-muted-foreground">{d.text}</span>
                {d.title && (it.taskId
                  ? <Link href={`/tasks/${it.taskId}`} className="truncate font-medium hover:text-accent-foreground">«{d.title}»</Link>
                  : <span className="truncate font-medium">«{d.title}»</span>)}
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">{relTime(it.createdAt, locale)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
