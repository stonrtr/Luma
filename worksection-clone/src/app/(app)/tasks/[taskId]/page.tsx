import { notFound, redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { BackButton } from "@/components/task/back-button";
import { requireUser } from "@/server/dal";
import { getTaskDetail } from "@/server/queries/tasks";
import { isProjectMember } from "@/server/queries/projects";
import { TaskControls } from "@/components/task/task-controls";
import { CommentForm } from "@/components/task/comment-form";
import { EditableTaskHeader } from "@/components/task/editable-task-header";
import { TagPicker } from "@/components/task/tag-picker";
import { Attachments } from "@/components/task/attachments";
import { ReviewButton } from "@/components/task/review-button";
import { StatusPopover, PriorityPopover } from "@/components/task/inline-controls";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials, formatDate } from "@/lib/format";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const user = await requireUser();

  const task = await getTaskDetail(taskId);
  if (!task) notFound();

  if (task.projectId) {
    const member = await isProjectMember(task.projectId, user.id);
    if (!member) redirect("/");
  } else {
    const isOwn = task.createdById === user.id || task.assignees.some((a) => a.user.id === user.id);
    if (!isOwn && user.role !== "OWNER" && user.role !== "ADMIN") redirect("/");
  }

  const members = task.project?.members.map((m) => ({ id: m.user.id, name: m.user.name })) ?? [];
  const assigneeId = task.assignees[0]?.user.id ?? null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <BackButton fallback={task.projectId ? `/projects/${task.projectId}` : "/"} />

      <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
        {/* Основная колонка */}
        <div className="space-y-6">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <StatusPopover taskId={task.id} status={task.status} />
              <PriorityPopover taskId={task.id} priority={task.priority} />
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

          {/* Комментарии */}
          <section className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
              <MessageSquare className="size-4" /> Коментарі ({task.comments.length})
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
                <p className="text-sm text-muted-foreground">Ще немає коментарів.</p>
              )}
            </div>
            <div className="mt-4 border-t pt-4">
              <CommentForm taskId={task.id} members={members} />
            </div>
          </section>
        </div>

        {/* Правая колонка — минимум полей */}
        <aside className="space-y-4">
          <div className="space-y-4 rounded-xl border bg-card p-4">
            <TaskControls taskId={task.id} assigneeId={assigneeId} members={members} />
            <div className="flex justify-between gap-4 border-t pt-3 text-sm">
              <span className="text-muted-foreground">Срок</span>
              <span className="text-right font-medium">{formatDate(task.dueDate)}</span>
            </div>
            {task.status !== "DONE" && task.status !== "TO_REVIEW" && (
              <div className="border-t pt-3">
                <ReviewButton taskId={task.id} />
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-card p-4">
            <Attachments taskId={task.id} items={task.attachments} />
          </div>
        </aside>
      </div>
    </div>
  );
}
