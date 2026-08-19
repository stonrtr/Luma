import { notFound, redirect } from "next/navigation";
import { MessageSquare, CalendarDays, Clock, User, Send, Play } from "lucide-react";
import { BackButton } from "@/components/task/back-button";
import { requireUser } from "@/server/dal";
import { db } from "@/server/db";
import { getTaskDetail } from "@/server/queries/tasks";
import { isProjectMember } from "@/server/queries/projects";
import { CommentForm } from "@/components/task/comment-form";
import { EditableTaskHeader } from "@/components/task/editable-task-header";
import { TagPicker } from "@/components/task/tag-picker";
import { Attachments } from "@/components/task/attachments";
import { Checklist } from "@/components/task/checklist";
import { WaitingFor } from "@/components/task/waiting-for";
import { ReviewButton } from "@/components/task/review-button";
import { ReviewDecision } from "@/components/task/review-decision";
import { DeleteTaskButton } from "@/components/task/delete-task-button";
import { StatusPopover, PriorityPopover, DueDatePopover, PlannedPopover, StartAtPopover } from "@/components/task/inline-controls";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials, formatDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { plannedLabel } from "@/lib/domain";
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

  if (task.projectId) {
    const member = await isProjectMember(task.projectId, user.id);
    if (!member) redirect("/");
  } else {
    const isOwn = task.createdById === user.id || task.assignees.some((a) => a.user.id === user.id);
    if (!isOwn && user.role !== "OWNER" && user.role !== "ADMIN") redirect("/");
  }

  const members = task.project?.members.map((m) => ({ id: m.user.id, name: m.user.name })) ?? [];
  const assignee = task.assignees[0]?.user ?? null;
  const overdue =!!(task.status !== "DONE" && task.dueDate && new Date(task.dueDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0));
  // Проверять задачу может админ/владелец или руководитель исполнителя
  const canReview = user.role === "OWNER" || user.role === "ADMIN" || task.assignees.some((a) => a.user.managerId === user.id);
  // «На проверку» имеет смысл, только если у исполнителя есть руководитель, кому отправлять
  const hasManager = task.assignees.some((a) => !!a.user.managerId);
  // Задача-«Перевірити …»: в описании метка /tasks/<id> — подтянем связанную
  // задачу, чтобы вынести вердикт прямо отсюда, не переходя по ссылке.
  const linkedId = task.description?.trim().match(/^\/tasks\/([a-z0-9]+)$/i)?.[1] ?? null;
  const linkedTask = linkedId && linkedId !== task.id
    ? await db.task.findUnique({
        where: { id: linkedId },
        select: { id: true, title: true, status: true, assignees: { select: { user: { select: { id: true, name: true, avatarUrl: true, managerId: true } } } } },
      })
    : null;
  const canManageLinked = !!linkedTask &&
    (user.role === "OWNER" || user.role === "ADMIN" || linkedTask.assignees.some((a) => a.user.managerId === user.id));
  const canReviewLinked = canManageLinked && linkedTask!.status === "TO_REVIEW";
  // Автор задачи-«Перевірити …» — подчинённый, приславший на проверку (исполнитель связанной задачи)
  const linkedAuthor = linkedTask?.assignees[0]?.user ?? null;

  // Кандидаты для «жду коллегу»
  const waitCandidates = (await db.user.findMany({
    where: { isActive: true, role: { not: "CLIENT" }, id: { not: user.id } },
    select: { id: true, name: true }, orderBy: { name: "asc" },
  }));

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <BackButton fallback={task.projectId ? `/projects/${task.projectId}` : "/"} />

      <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
        {/* Основная колонка */}
        <div className="space-y-6">
          <div>
            <EditableTaskHeader
              taskId={task.id}
              title={task.title}
              description={task.description}
              trailing={
                <>
                  <StatusPopover taskId={task.id} status={task.status} />
                  <PriorityPopover taskId={task.id} priority={task.priority} />
                </>
              }
            />
            {/* Теги — отдельной строкой под заголовком */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
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

            {/* Сводка: исполнитель, дедлайн, плановий час */}
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <div className="flex items-center gap-2">
                {assignee ? (
                  <>
                    <Avatar className="size-6">
                      {assignee.avatarUrl && <AvatarImage src={assignee.avatarUrl} alt={assignee.name} />}
                      <AvatarFallback className="text-[10px]">{initials(assignee.name)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{assignee.name}</span>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <User className="size-4" /> {t(user.locale, "tc.noAssignee")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Play className="size-4" />
                <StartAtPopover taskId={task.id} scheduledAt={task.scheduledAt ? task.scheduledAt.toISOString() : null} locale={user.locale} />
              </div>
              <div className="flex items-center gap-1.5">
                <CalendarDays className={cn("size-4", overdue ? "text-red-600" : "text-muted-foreground")} />
                <DueDatePopover taskId={task.id} dueDate={task.dueDate ? task.dueDate.toISOString() : null} locale={user.locale} overdue={overdue} />
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="size-4" />
                <PlannedPopover taskId={task.id} plannedMinutes={task.plannedMinutes} locale={user.locale} />
              </div>
            </div>
          </div>

          {/* Чек-лист шагов задачи */}
          <section className="rounded-xl border bg-card p-4">
            <Checklist taskId={task.id} items={task.checklist.map((c) => ({ id: c.id, text: c.text, done: c.done }))} />
          </section>

          {/* Комментарии */}
          <section className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
              <MessageSquare className="size-4" /> {t(user.locale, "task.commentsH")} ({task.comments.length})
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
                      <span className="text-xs text-muted-foreground">{formatDate(c.createdAt, user.locale)}</span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm">{c.body}</p>
                  </div>
                </div>
              ))}
              {task.comments.length === 0 && (
                <p className="text-sm text-muted-foreground">{t(user.locale, "task.noComments")}</p>
              )}
            </div>
            <div className="mt-4 border-t pt-4">
              <CommentForm taskId={task.id} members={members} />
            </div>
          </section>
        </div>

        {/* Правая колонка — минимум полей */}
        <aside className="space-y-4">
          {/* Панель проверки — для задачи-«Перевірити …»: автор + вердикт */}
          {linkedTask && canManageLinked && (
            <div className="space-y-3 rounded-xl border bg-card p-4">
              {/* Чья это задача — подчинённый, приславший на проверку */}
              {linkedAuthor && (
                <div className="flex items-center gap-2">
                  <Avatar className="size-7">{linkedAuthor.avatarUrl && <AvatarImage src={linkedAuthor.avatarUrl} alt="" />}<AvatarFallback className="text-[10px]">{initials(linkedAuthor.name)}</AvatarFallback></Avatar>
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground leading-none">{t(user.locale, "rb.fromEmployee")}</p>
                    <p className="truncate text-sm font-medium">{linkedAuthor.name}</p>
                  </div>
                </div>
              )}
              {canReviewLinked ? (
                <ReviewDecision taskId={linkedTask.id} />
              ) : (
                <p className="text-xs text-muted-foreground">{t(user.locale, "rb.notInReview")}</p>
              )}
            </div>
          )}
          {task.status !== "DONE" && (
            <div className="rounded-xl border bg-card p-4">
              <WaitingFor taskId={task.id} current={task.waitingFor} candidates={waitCandidates} />
            </div>
          )}

          {/* Проверка руководителем — только если у исполнителя есть руководитель */}
          {hasManager && (task.status === "TO_REVIEW" ? (
            canReview ? (
              <div className="rounded-xl border bg-card p-4">
                <ReviewDecision taskId={task.id} />
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
                <Send className="size-4" /> {t(user.locale, "rb.onReview")}
              </div>
            )
          ) : task.status !== "DONE" ? (
            <div className="rounded-xl border bg-card p-4">
              <ReviewButton taskId={task.id} />
            </div>
          ) : null)}

          <div className="rounded-xl border bg-card p-4">
            <Attachments taskId={task.id} items={task.attachments} />
          </div>

          <DeleteTaskButton taskId={task.id} fallback="/" />
        </aside>
      </div>
    </div>
  );
}
