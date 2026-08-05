import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/server/dal";
import { getProjectById, isProjectMember } from "@/server/queries/projects";
import { getBoardTasks } from "@/server/queries/tasks";
import { getUsersNotInProject } from "@/server/queries/users";
import { getGanttData } from "@/server/queries/gantt";
import { KanbanBoard } from "@/components/board/kanban-board";
import { TaskList } from "@/components/board/task-list";
import { GanttChart } from "@/components/gantt/gantt-chart";
import { ManageMembers } from "@/components/project/manage-members";
import type { BoardTask } from "@/components/board/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_STYLE } from "@/lib/domain";
import { initials, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function ProjectBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { projectId } = await params;
  const { view } = await searchParams;
  const user = await requireUser();

  const member = await isProjectMember(projectId, user.id);
  if (!member) redirect("/");

  const project = await getProjectById(projectId);
  if (!project) notFound();

  const [tasks, candidates] = await Promise.all([
    getBoardTasks(projectId),
    getUsersNotInProject(projectId),
  ]);

  const boardTasks: BoardTask[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    position: t.position,
    assignedByManager: t.assignedByManager,
    plannedMinutes: t.plannedMinutes,
    isProject: !!t.projectId,
    assignees: t.assignees.map((a) => ({ id: a.user.id, name: a.user.name })),
    tags: t.tags.map((tt) => ({ id: tt.tag.id, name: tt.tag.name, color: tt.tag.color })),
    subtaskCount: t._count.subtasks,
    commentCount: t._count.comments,
    checklistTotal: t._count.checklist,
    checklistDone: t.checklist.filter((c) => c.done).length,
  }));

  const members = project.members.map((m) => ({ id: m.user.id, name: m.user.name }));
  const isList = view === "list";
  const isGantt = view === "gantt";

  const gantt = isGantt ? await getGanttData(projectId) : null;

  return (
    <div className="flex h-full flex-col">
      <header className="border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="size-3 rounded-full" style={{ backgroundColor: project.color }} />
          <h1 className="text-xl font-semibold tracking-tight">{project.name}</h1>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              PROJECT_STATUS_STYLE[project.status],
            )}
          >
            {PROJECT_STATUS_LABEL[project.status]}
          </span>
          <div className="ml-auto flex items-center gap-4">
            {project.dueDate && (
              <span className="text-xs text-muted-foreground">Срок: {formatDate(project.dueDate)}</span>
            )}
            <ManageMembers
              projectId={projectId}
              members={project.members.map((m) => ({
                userId: m.user.id,
                name: m.user.name,
                role: m.role,
                isSelf: m.user.id === user.id,
              }))}
              candidates={candidates}
            />
            <div className="flex -space-x-2">
              {project.members.map((m) => (
                <Avatar key={m.id} className="size-7 border-2 border-background" title={m.user.name}>
                  <AvatarFallback className="text-[10px]">{initials(m.user.name)}</AvatarFallback>
                </Avatar>
              ))}
            </div>
          </div>
        </div>
        {project.description && (
          <p className="mt-1.5 text-sm text-muted-foreground">{project.description}</p>
        )}

        {/* Вкладки представлений */}
        <div className="mt-3 flex gap-1">
          <Link
            href={`/projects/${projectId}`}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium transition-colors",
              !isList ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            Доска
          </Link>
          <Link
            href={`/projects/${projectId}?view=list`}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium transition-colors",
              isList ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            Список
          </Link>
          <Link
            href={`/projects/${projectId}?view=gantt`}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium transition-colors",
              isGantt ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            Гант
          </Link>
        </div>
      </header>

      <div className="flex-1 overflow-auto px-6 py-4">
        {isGantt && gantt ? (
          <GanttChart
            tasks={gantt.tasks.map((t) => ({
              id: t.id,
              title: t.title,
              status: t.status,
              startDate: t.startDate ? t.startDate.toISOString() : null,
              dueDate: t.dueDate ? t.dueDate.toISOString() : null,
              assignees: t.assignees.map((a) => a.user.name),
            }))}
            deps={gantt.deps.map((d) => ({ predecessorId: d.predecessorId, successorId: d.successorId }))}
            milestones={gantt.milestones.map((m) => ({
              id: m.id,
              title: m.title,
              dueDate: m.dueDate ? m.dueDate.toISOString() : null,
            }))}
          />
        ) : isList ? (
          <TaskList tasks={boardTasks} />
        ) : (
          <KanbanBoard projectId={projectId} initialTasks={boardTasks} members={members} />
        )}
      </div>
    </div>
  );
}
