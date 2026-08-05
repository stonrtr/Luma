import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Clock, GitBranch, MessageSquare } from "lucide-react";
import { requireUser } from "@/server/dal";
import { getTaskDetail } from "@/server/queries/tasks";
import { isProjectMember } from "@/server/queries/projects";
import { TaskControls } from "@/components/task/task-controls";
import { Checklist } from "@/components/task/checklist";
import { CommentForm } from "@/components/task/comment-form";
import { TimeLogForm } from "@/components/task/time-log-form";
import { AddSubtask } from "@/components/task/add-subtask";
import { EditableTaskHeader } from "@/components/task/editable-task-header";
import { TagPicker } from "@/components/task/tag-picker";
import { Attachments } from "@/components/task/attachments";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  TASK_STATUS_LABEL,
  TASK_STATUS_STYLE,
  priorityStyle,
  plannedLabel,
} from "@/lib/domain";
import { initials, formatDate, formatMinutes } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const user = await requireUser();

  const task = await getTaskDetail(taskId);
  if (!task) notFound();

  // задача проекта → проверяем участие; личная задача (без проекта) доступна создателю/исполнителю
  if (task.projectId) {
    const member = await isProjectMember(task.projectId, user.id);
    if (!member) redirect("/");
  } else {
    const isOwn = task.createdById === user.id || task.assignees.some((a) => a.user.id === user.id);
    if (!isOwn && user.role !== "OWNER" && user.role !== "ADMIN") redirect("/");
  }

  const members = task.project?.members.map((m) => ({ id: m.user.id, name: m.user.name })) ?? [];
  const assigneeId = task.assignees[0]?.user.id ?? null;
  const totalMinutes = task.timeLogs.reduce((s, l) => s + l.minutes, 0);

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <Link
        href={task.projectId ? `/projects/${task.projectId}` : "/"}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {task.project?.name ?? "На головну"}
      </Link>

      {task.parent && (
        <p className="mb-2 text-xs text-muted-foreground">
          Подзадача ·{" "}
          <Link href={`/tasks/${task.parent.id}`} className="hover:text-foreground">
            {task.parent.title}
          </Link>
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        {/* Основная колонка */}
        <div className="space-y-6">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", TASK_STATUS_STYLE[task.status])}>
                {TASK_STATUS_LABEL[task.status]}
              </span>
              <span className={cn("flex size-5 items-center justify-center rounded text-[11px] font-semibold", priorityStyle(task.priority))} title={`Пріоритет ${task.priority}`}>
                {task.priority}
              </span>
              {task.tags.map((t) => (
                <span
                  key={t.tag.id}
                  className="rounded px-1.5 py-0.5 text-[11px] font-medium"
                  style={{ backgroundColor: `${t.tag.color}22`, color: t.tag.color }}
                >
                  {t.tag.name}
                </span>
              ))}
              {task.projectId && task.project && (
                <TagPicker
                  taskId={task.id}
                  projectId={task.projectId}
                  allTags={task.project.tags}
                  selectedIds={task.tags.map((t) => t.tag.id)}
                />
              )}
            </div>
            <EditableTaskHeader taskId={task.id} title={task.title} description={task.description} />
          </div>

          {/* Подзадачи */}
          <section className="rounded-xl border bg-card p-4">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <GitBranch className="size-4" /> Подзадачи ({task.subtasks.length})
            </h3>
            <ul className="space-y-1">
              {task.subtasks.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/tasks/${s.id}`}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <span className={cn("size-2 rounded-full", TASK_STATUS_STYLE[s.status].split(" ")[0])} />
                    <span className={s.status === "DONE" ? "text-muted-foreground line-through" : ""}>{s.title}</span>
                    <span className="ml-auto flex -space-x-1.5">
                      {s.assignees.map((a) => (
                        <Avatar key={a.user.id} className="size-5 border border-card">
                          <AvatarFallback className="text-[8px]">{initials(a.user.name)}</AvatarFallback>
                        </Avatar>
                      ))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <AddSubtask projectId={task.projectId ?? ""} parentId={task.id} />
          </section>

          {/* Чек-лист */}
          <section className="rounded-xl border bg-card p-4">
            <Checklist taskId={task.id} items={task.checklist} />
          </section>

          {/* Комментарии */}
          <section className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
              <MessageSquare className="size-4" /> Комментарии ({task.comments.length})
            </h3>
            <div className="space-y-4">
              {task.comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <Avatar className="size-8 shrink-0">
                    <AvatarFallback className="text-[10px]">{initials(c.author.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium">{c.author.name}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm">{c.body}</p>
                  </div>
                </div>
              ))}
              {task.comments.length === 0 && (
                <p className="text-sm text-muted-foreground">Пока нет комментариев.</p>
              )}
            </div>
            <div className="mt-4 border-t pt-4">
              <CommentForm taskId={task.id} />
            </div>
          </section>
        </div>

        {/* Правая колонка */}
        <aside className="space-y-6">
          <div className="rounded-xl border bg-card p-4">
            <TaskControls
              taskId={task.id}
              status={task.status}
              priority={task.priority}
              assigneeId={assigneeId}
              members={members}
            />
            <div className="mt-4 space-y-2 border-t pt-4 text-sm">
              <Row label="Срок" value={formatDate(task.dueDate)} />
              <Row label="Планований час" value={task.plannedMinutes ? plannedLabel(task.plannedMinutes) : "—"} />
              <Row label="Автор" value={task.createdBy.name} />
              <Row label="Веха" value={task.milestone?.title ?? "—"} />
            </div>
          </div>

          {/* Вложения */}
          <div className="rounded-xl border bg-card p-4">
            <Attachments taskId={task.id} items={task.attachments} />
          </div>

          {/* Учёт времени */}
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
              <Clock className="size-4" /> Время: {formatMinutes(totalMinutes)}
            </h3>
            <TimeLogForm taskId={task.id} />
            {task.timeLogs.length > 0 && (
              <ul className="mt-3 space-y-1.5 border-t pt-3">
                {task.timeLogs.map((l) => (
                  <li key={l.id} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {l.user.name}
                      {l.note ? ` · ${l.note}` : ""}
                    </span>
                    <span className="font-medium">{formatMinutes(l.minutes)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
