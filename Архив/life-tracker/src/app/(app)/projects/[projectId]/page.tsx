import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/server/dal";
import { getProjectById, isProjectMember, getProjectTimeStats, getRecurringForProject } from "@/server/queries/projects";
import { getBoardTasks } from "@/server/queries/tasks";
import { getUsersNotInProject } from "@/server/queries/users";
import { getGanttData } from "@/server/queries/gantt";
import { KanbanBoard } from "@/components/board/kanban-board";
import { TaskList } from "@/components/board/task-list";
import { GanttChart } from "@/components/gantt/gantt-chart";
import { ManageMembers } from "@/components/project/manage-members";
import { ProjectActions } from "@/components/project/project-actions";
import { RecurringBlock } from "@/components/planning/recurring-block";
import { isAdmin } from "@/server/authz";
import type { BoardTask } from "@/components/board/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PROJECT_STATUS_STYLE } from "@/lib/domain";
import { projectStatusLabel, t } from "@/lib/i18n";
import { initials, formatDate, formatMinutes } from "@/lib/format";
import { Clock } from "lucide-react";
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
  const canManage = member || isAdmin(user.role);
  if (!canManage) redirect("/"); // доступ — учасникам проєкту та адмінам

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
    fromSummary: t.fromSummary,
    plannedMinutes: t.plannedMinutes,
    isProject: !!t.projectId,
    assignees: t.assignees.map((a) => ({ id: a.user.id, name: a.user.name, avatarUrl: a.user.avatarUrl })),
    tags: t.tags.map((tt) => ({ id: tt.tag.id, name: tt.tag.name, color: tt.tag.color })),
    subtaskCount: t._count.subtasks,
    commentCount: t._count.comments,
    checklistTotal: t._count.checklist,
    checklistDone: t.checklist.filter((c) => c.done).length,
  }));

  const members = project.members.map((m) => ({ id: m.user.id, name: m.user.name }));
  const isList = view === "list";
  const isGantt = view === "gantt";
  const isRecurring = view === "recurring";

  const [gantt, timeStats, recurring] = await Promise.all([
    isGantt ? getGanttData(projectId) : Promise.resolve(null),
    getProjectTimeStats(projectId, user.id),
    isRecurring ? getRecurringForProject(projectId) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col">
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
            {projectStatusLabel(user.locale, project.status)}
          </span>
          <div className="ml-auto flex items-center gap-4">
            <span className="flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1 text-xs" title={t(user.locale, "ov.time")}>
              <Clock className="size-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">{t(user.locale, "ov.week")}</span>
              <b>{formatMinutes(timeStats.week, user.locale)}</b>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{t(user.locale, "ov.month")}</span>
              <b>{formatMinutes(timeStats.month, user.locale)}</b>
            </span>
            {project.dueDate && (
              <span className="text-xs text-muted-foreground">{t(user.locale, "proj.due")}: {formatDate(project.dueDate, user.locale)}</span>
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
            <ProjectActions projectId={projectId} status={project.status} />
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
            {t(user.locale, "proj.board")}
          </Link>
          <Link
            href={`/projects/${projectId}?view=list`}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium transition-colors",
              isList ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {t(user.locale, "proj.list")}
          </Link>
          <Link
            href={`/projects/${projectId}?view=gantt`}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium transition-colors",
              isGantt ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {t(user.locale, "proj.gantt")}
          </Link>
          <Link
            href={`/projects/${projectId}?view=recurring`}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium transition-colors",
              isRecurring ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {t(user.locale, "rec.title")}
          </Link>
        </div>
      </header>

      <div className="overflow-x-auto px-6 py-4">
        {isRecurring ? (
          <div className="max-w-xl">
            <RecurringBlock userId={user.id} items={recurring} canEdit projectId={projectId} />
          </div>
        ) : isGantt && gantt ? (
          <GanttChart
            locale={user.locale}
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
          <KanbanBoard projectId={projectId} initialTasks={boardTasks} members={members} locale={user.locale} />
        )}
      </div>
    </div>
  );
}
