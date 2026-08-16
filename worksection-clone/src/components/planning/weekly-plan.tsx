"use client";
import { t, taskStatusLabel } from "@/lib/i18n";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ListChecks, Plus, X, CheckCheck, Send, Undo2, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { TaskStatus } from "@/generated/prisma/enums";
import { addPlanItem, addExistingTaskToPlan, deletePlanItem, approvePlan, submitPlanForApproval, returnPlan } from "@/server/actions/planning";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NewTaskDialog } from "@/components/board/new-task-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PRIORITY_VALUES, DEFAULT_PRIORITY, priorityStyle, priorityTone, TASK_STATUS_LABEL, TASK_STATUS_STYLE } from "@/lib/domain";
import { isoWeekNumber } from "@/lib/week";
import { cn } from "@/lib/utils";

type Item = {
  id: string; title: string; priority: number; approved: boolean;
  projectId: string | null; task: { id: string; status: TaskStatus } | null;
};
type Project = { id: string; name: string; color: string };
type AvailableTask = { id: string; title: string; priority: number };

const MIN_SLOTS = 3;

type PlanStatus = "DRAFT" | "PENDING" | "APPROVED" | "RETURNED";

export function WeeklyPlan({
  userId, weekStart, items, projects, availableTasks, canEdit, status = "DRAFT", comment = null, isSelf = false, canManage = false, ownerIsTopAdmin = false, locale = "uk",
}: {
  userId: string; weekStart: string; items: Item[]; projects: Project[]; availableTasks: AvailableTask[]; canEdit: boolean;
  status?: PlanStatus; comment?: string | null; isSelf?: boolean; canManage?: boolean; ownerIsTopAdmin?: boolean; locale?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "existing">("create");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState(DEFAULT_PRIORITY);
  const [projectId, setProjectId] = useState("none");
  const [taskId, setTaskId] = useState("");
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [returning, setReturning] = useState(false);
  const [returnComment, setReturnComment] = useState("");
  const [pending, start] = useTransition();

  const unapproved = items.filter((i) => !i.approved).length;
  const emptySlots = Math.max(0, MIN_SLOTS - items.length);
  const weekNo = isoWeekNumber(new Date(weekStart));

  function add() {
    if (!title.trim()) return;
    const tt = title.trim();
    setTitle("");
    start(async () => {
      const res = await addPlanItem({ userId, weekStart, title: tt, priority, projectId: projectId === "none" ? undefined : projectId });
      if (res?.error) toast.error(res.error);
      router.refresh();
    });
  }

  function addExisting() {
    if (!taskId) { toast.error(t(locale, "plan.selectTask")); return; }
    const id = taskId;
    setTaskId("");
    start(async () => {
      const res = await addExistingTaskToPlan({ userId, weekStart, taskId: id });
      if (res?.error) toast.error(res.error);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <ListChecks className="size-4 text-accent-foreground" /> {t(locale, "plan.weekPriorities")} №{weekNo}
          <span className="text-xs font-normal text-muted-foreground">({items.length})</span>
          <StatusBadge status={status} locale={locale} />
        </h3>
        <div className="flex items-center gap-1.5">
          {/* Руководитель утверждает: для присланного плана (PENDING) — всегда; либо когда есть неутверждённые пункты */}
          {canManage && (status === "PENDING" || unapproved > 0) && (
            <Button size="sm" onClick={() => start(async () => { const r = await approvePlan({ userId, weekStart }); if (r?.error) toast.error(r.error); else { toast.success(t(locale, "plan.approvedCreated")); router.refresh(); } })} disabled={pending}>
              <CheckCheck className="size-4" /> {t(locale, "plan.approve")}{unapproved > 0 ? ` (${unapproved})` : ""}
            </Button>
          )}
          {/* Руководитель возвращает на доработку — инлайн-поле с комментарием */}
          {canManage && !isSelf && status === "PENDING" && !returning && (
            <Button size="sm" variant="outline" onClick={() => setReturning(true)} disabled={pending}>
              <Undo2 className="size-4" /> {t(locale, "plan.return")}
            </Button>
          )}
        </div>
      </div>
      {/* Форма возврата: причина обязательна, летит сотруднику пушем */}
      {returning && (
        <div className="mb-2 space-y-2 rounded-lg border border-dashed p-3">
          <Textarea autoFocus rows={2} value={returnComment} onChange={(e) => setReturnComment(e.target.value)} placeholder={t(locale, "plan.returnPrompt")} />
          <div className="flex gap-2">
            <Button size="sm" disabled={pending || !returnComment.trim()} onClick={() => start(async () => {
              const r = await returnPlan({ userId, weekStart, comment: returnComment.trim() });
              if (r?.error) toast.error(r.error);
              else { toast.success(t(locale, "plan.returnedRevision")); setReturning(false); setReturnComment(""); router.refresh(); }
            })}>
              <Undo2 className="size-4" /> {t(locale, "plan.return")}
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => { setReturning(false); setReturnComment(""); }}>
              {t(locale, "common.cancel")}
            </Button>
          </div>
        </div>
      )}
      <p className="mb-2 text-xs text-muted-foreground">{t(locale, "plan.hint")}</p>
      {status === "RETURNED" && comment && (
        <p className="mb-2 rounded-lg bg-[#FBE6D6] text-[#A0561F] dark:bg-[#33210f] dark:text-[#e2b382] px-3 py-2 text-xs">
          {t(locale, "plan.managerReturned")} {comment}
        </p>
      )}

      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.id} className="group flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
            <span className="flex size-[19px] shrink-0 items-center justify-center rounded-full border-[1.25px] bg-transparent text-[10px] font-semibold" style={{ color: priorityTone(item.priority), borderColor: priorityTone(item.priority) }}>
              {item.priority}
            </span>
            {item.task ? (
              <Link href={`/tasks/${item.task.id}`} className="flex-1 text-sm hover:text-accent-foreground">{item.title}</Link>
            ) : (
              <span className="flex-1 text-sm">{item.title}</span>
            )}
            {item.approved && item.task ? (
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", TASK_STATUS_STYLE[item.task.status])}>
                {taskStatusLabel(locale, item.task.status)}
              </span>
            ) : (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{t(locale, "plan.draft")}</span>
            )}
            {canEdit && !item.approved && (
              <button onClick={() => start(async () => { await deletePlanItem(item.id); router.refresh(); })} className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100">
                <X className="size-3.5" />
              </button>
            )}
          </li>
        ))}
        {/* пустые слоты-заготовки до минимума */}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <li key={`slot-${i}`} className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            <span className="flex size-5 shrink-0 items-center justify-center rounded bg-muted text-[11px] font-semibold text-muted-foreground">{items.length + i + 1}</span>
            {t(locale, "plan.emptySlot")}
          </li>
        ))}
      </ul>

      {canEdit && (
        <div className="mt-3 space-y-2 rounded-lg border border-dashed p-3">
          <div className="flex gap-1">
            <button type="button" onClick={() => setMode("create")} className={cn("flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors", mode === "create" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted")}>
              {t(locale, "plan.createNew")}
            </button>
            <button type="button" onClick={() => setMode("existing")} className={cn("flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors", mode === "existing" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted")}>
              {t(locale, "plan.pickExisting")}
            </button>
          </div>

          {mode === "create" ? (
            <button type="button" onClick={() => setNewTaskOpen(true)} className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed py-2 text-sm text-muted-foreground hover:bg-muted">
              <Plus className="size-4" /> {t(locale, "plan.createTask")}
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {availableTasks.length > 0 ? (
                <>
                  <Select value={taskId} onValueChange={setTaskId}>
                    <SelectTrigger className="h-8 min-w-0 flex-1"><SelectValue placeholder={t(locale, "plan.selectTaskPh")} /></SelectTrigger>
                    <SelectContent>
                      {availableTasks.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="flex size-4 items-center justify-center rounded-full border-[1.25px] bg-transparent text-[9px] font-semibold" style={{ color: priorityTone(t.priority), borderColor: priorityTone(t.priority) }}>{t.priority}</span>
                            {t.title}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button onClick={addExisting} disabled={pending} className="flex size-8 items-center justify-center rounded-md border hover:bg-muted disabled:opacity-50"><Plus className="size-4" /></button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">{t(locale, "task.noAvail")}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Отправить на утверждение — крупная кнопка внизу контейнера (кроме главного админа) */}
      {isSelf && !ownerIsTopAdmin && (status === "DRAFT" || status === "RETURNED") && (
        <Button
          className="mt-3 h-11 w-full text-sm"
          disabled={pending}
          onClick={() => start(async () => { const r = await submitPlanForApproval({ weekStart }); if (r?.error) toast.error(r.error); else { toast.success(t(locale, "plan.sentToManager")); router.refresh(); } })}
        >
          <Send className="size-4" /> {t(locale, "plan.submitApproval")}
        </Button>
      )}

      <NewTaskDialog
        locale={locale}
        projectId=""
        members={[]}
        status={newTaskOpen ? "TODO" : null}
        onClose={() => setNewTaskOpen(false)}
        lockedAssigneeId={userId}
        projects={projects}
        headerTitle={t(locale, "plan.newWeekTask")}
        onCreated={(newId) => { setNewTaskOpen(false); start(async () => { await addExistingTaskToPlan({ userId, weekStart, taskId: newId }); router.refresh(); }); }}
      />
    </div>
  );
}

function StatusBadge({ status, locale }: { status: PlanStatus; locale: string }) {
  if (status === "DRAFT") return null;
  const map = {
    PENDING: { label: t(locale, "plan.stPending"), cls: "bg-[#FBE6D6] text-[#A0561F] dark:bg-[#33210f] dark:text-[#e2b382]", Icon: Clock },
    APPROVED: { label: t(locale, "plan.stApproved"), cls: "bg-accent text-accent-foreground", Icon: CheckCircle2 },
    RETURNED: { label: t(locale, "plan.stReturned"), cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300", Icon: Undo2 },
  } as const;
  const { label, cls, Icon } = map[status];
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", cls)}><Icon className="size-3" /> {label}</span>;
}
