import Link from "next/link";
import { requireUser } from "@/server/dal";
import { getProjectsForUser } from "@/server/queries/projects";
import { NewProjectDialog } from "@/components/project/new-project-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_STYLE } from "@/lib/domain";
import { initials, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function ProjectsPage() {
  const user = await requireUser();
  const projects = await getProjectsForUser(user.id);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Проєкти</h1>
          <p className="mt-1 text-sm text-muted-foreground">Спільна робота над проєктами команди</p>
        </div>
        <NewProjectDialog />
      </div>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">Проєктів поки немає.</p>
          <div className="mt-4 flex justify-center">
            <NewProjectDialog />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const progress = p.totalCount ? Math.round((p.doneCount / p.totalCount) * 100) : 0;
            return (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="group rounded-xl border bg-card p-5 transition-all hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <span className="size-3 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", PROJECT_STATUS_STYLE[p.status])}>
                    {PROJECT_STATUS_LABEL[p.status]}
                  </span>
                </div>
                <h3 className="mt-3 font-medium group-hover:text-primary">{p.name}</h3>
                {p.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>{p.doneCount} з {p.totalCount} задач</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {p.members.slice(0, 4).map((m) => (
                      <Avatar key={m.id} className="size-7 border-2 border-card">
                        <AvatarFallback className="text-[10px]">{initials(m.user.name)}</AvatarFallback>
                      </Avatar>
                    ))}
                    {p.members.length > 4 && (
                      <span className="flex size-7 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] text-muted-foreground">
                        +{p.members.length - 4}
                      </span>
                    )}
                  </div>
                  {p.dueDate && <span className="text-xs text-muted-foreground">до {formatDate(p.dueDate)}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
