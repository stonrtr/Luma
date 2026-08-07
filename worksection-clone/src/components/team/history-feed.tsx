import Link from "next/link";
import { History } from "lucide-react";
import { TASK_STATUS_LABEL } from "@/lib/domain";
import type { TaskStatus } from "@/generated/prisma/enums";

export type HistoryItem = {
  id: string; type: string; actorName: string;
  taskId: string | null; meta: string | null; createdAt: string;
};

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "щойно";
  if (m < 60) return `${m} хв тому`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} год тому`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} дн тому`;
  return new Date(iso).toLocaleDateString("uk-UA", { day: "2-digit", month: "short" });
}

function describe(item: HistoryItem): { text: string; title: string | null } {
  if (item.type === "task.created") {
    return { text: "створив(ла) задачу", title: item.meta };
  }
  if (item.type === "comment.added") {
    return { text: "прокоментував(ла)", title: item.meta };
  }
  if (item.type === "task.status") {
    try {
      const m = JSON.parse(item.meta ?? "{}") as { title?: string; to?: TaskStatus };
      const VERB: Record<TaskStatus, string> = {
        DONE: "завершив(ла)",
        TO_REVIEW: "відправив(ла) на перевірку",
        IN_PROGRESS: "взяв(ла) в роботу",
        TODO: "повернув(ла) у «Зробити»",
        IDEA: "переніс(ла) в «Ідеї»",
      };
      const verb = m.to ? VERB[m.to] : "змінив(ла) статус";
      return { text: verb, title: m.title ?? null };
    } catch {
      return { text: "змінив(ла) статус", title: null };
    }
  }
  return { text: item.type, title: item.meta };
}

// История действий команды: создание задач, смены статусов, закрытия
export function HistoryFeed({ items }: { items: HistoryItem[] }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
        <History className="size-4 text-muted-foreground" /> Історія
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Поки без активності.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {items.map((it) => {
            const d = describe(it);
            return (
              <li key={it.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                <span className="font-medium">{it.actorName}</span>
                <span className="text-muted-foreground">{d.text}</span>
                {d.title && (it.taskId
                  ? <Link href={`/tasks/${it.taskId}`} className="truncate font-medium hover:text-primary">«{d.title}»</Link>
                  : <span className="truncate font-medium">«{d.title}»</span>)}
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">{relTime(it.createdAt)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
