import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/format";

export type ArchiveRow = {
  id: string; title: string;
  projectName: string | null; projectColor: string | null;
  completedAt: string | null;
  assignees: { id: string; name: string }[];
};

function fmt(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("uk-UA", { day: "2-digit", month: "short", year: "numeric" });
}

// Архив завершённых задач: от последней выполненной вниз
export function ArchiveList({ rows }: { rows: ArchiveRow[] }) {
  if (rows.length === 0) return <p className="px-1 text-sm text-muted-foreground">Архів порожній.</p>;
  return (
    <div className="divide-y rounded-xl border bg-card">
      {rows.map((t) => (
        <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
          <span className="w-24 shrink-0 text-xs text-muted-foreground">{fmt(t.completedAt)}</span>
          <Link href={`/tasks/${t.id}`} className="flex-1 truncate text-sm font-medium text-muted-foreground line-through hover:text-foreground">
            {t.title}
          </Link>
          {t.projectName && (
            <span className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:inline-flex">
              <span className="size-1.5 rounded-full" style={{ backgroundColor: t.projectColor ?? "#6366f1" }} />
              {t.projectName}
            </span>
          )}
          <div className="flex shrink-0 -space-x-1.5">
            {t.assignees.map((a) => (
              <Avatar key={a.id} className="size-6 border-2 border-card" title={a.name}>
                <AvatarFallback className="text-[9px]">{initials(a.name)}</AvatarFallback>
              </Avatar>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
