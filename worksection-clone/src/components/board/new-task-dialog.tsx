"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Repeat, ChevronDown } from "lucide-react";
import { t, taskStatusLabel, freqLabel } from "@/lib/i18n";
import type { TaskStatus } from "@/generated/prisma/enums";
import type { BoardMember } from "./types";
import { createTask } from "@/server/actions/tasks";
import { createRecurringTask } from "@/server/actions/recurring";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PRIORITY_VALUES,
  DEFAULT_PRIORITY,
  priorityStyle,
  PLANNED_MINUTES,
  plannedLabel,
} from "@/lib/domain";
import { cn } from "@/lib/utils";
import { parseTaskLine } from "@/lib/summary";

const pad = (n: number) => String(n).padStart(2, "0");
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const WEEKDAYS: [string, string][] = [["1", "Пн"], ["2", "Вт"], ["3", "Ср"], ["4", "Чт"], ["5", "Пт"], ["6", "Сб"], ["7", "Нд"]];

export function NewTaskDialog({
  projectId,
  members,
  status,
  onClose,
  lockedAssigneeId,
  defaultAssigneeId,
  projects,
  initialTitle,
  initialStatus,
  initialDueDate,
  initialStartDate,
  initialStartTime,
  headerTitle,
  cancelLabel,
  extraFooter,
  onCreated,
  defaultProjectId,
  locale = "uk",
}: {
  projectId: string;
  members: BoardMember[];
  status: TaskStatus | null;
  onClose: () => void;
  lockedAssigneeId?: string;
  defaultAssigneeId?: string;
  projects?: { id: string; name: string; color: string }[];
  initialTitle?: string;
  initialStatus?: TaskStatus;
  initialDueDate?: string;
  initialStartDate?: string;
  initialStartTime?: string;
  headerTitle?: string;
  cancelLabel?: string;
  extraFooter?: React.ReactNode;
  onCreated?: (taskId: string) => void;
  defaultProjectId?: string;
  locale?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(initialTitle ?? "");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<number>(DEFAULT_PRIORITY);
  const [taskStatus, setTaskStatus] = useState<TaskStatus>(initialStatus ?? "TODO");
  const [plannedMinutes, setPlannedMinutes] = useState<number>(30);
  // Мультивибір виконавців (галочки) — можна поставити одну задачу відразу кільком
  const [assignees, setAssignees] = useState<Set<string>>(
    new Set([defaultAssigneeId ?? members[0]?.id].filter(Boolean) as string[]),
  );
  const toggleAssignee = (id: string) =>
    setAssignees((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const [assigneeOpen, setAssigneeOpen] = useState(false); // список виконавців згорнутий за замовч.
  // Проект: если диалог открыт со страницы проекта — он подставлен по умолчанию
  const presetProject = defaultProjectId && projects?.some((p) => p.id === defaultProjectId) ? defaultProjectId : "base";
  const [projectSel, setProjectSel] = useState<string>(presetProject);
  useEffect(() => { if (status) setProjectSel(presetProject); }, [status, presetProject]);
  const [dueDate, setDueDate] = useState(initialDueDate ?? "");
  // «Час старту» звичайної задачі → scheduledAt (для календаря). Порожньо; вписують вручну
  // (нативний пікер дати відкривається на сьогоднішній даті).
  const [startAtDate, setStartAtDate] = useState(initialStartDate ?? "");
  const [startAtTime, setStartAtTime] = useState(initialStartTime ?? "");
  // Тип: звичайна задача чи регулярна (за замовч. звичайна)
  const [recurring, setRecurring] = useState(false);
  const [frequency, setFrequency] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("WEEKLY");
  const [days, setDays] = useState<Set<string>>(new Set(["1", "2", "3", "4", "5"]));
  const [startDate, setStartDate] = useState(todayStr()); // «Час старту» — для щомісячної: з нього беремо число місяця
  const [recDueDate, setRecDueDate] = useState(todayStr()); // щомісячна: число-дедлайн
  const [byManager, setByManager] = useState(false); // мітка «від керівника»
  const [fromSummary, setFromSummary] = useState(false); // мітка «з самарі»
  const toggleDay = (d: string) => setDays((prev) => { const n = new Set(prev); n.has(d) ? n.delete(d) : n.add(d); return n; });

  // выбор проекта показываем только в личном контексте (нет жёсткого проекта) и если проекты есть
  const showProjectSelect = !projectId && !!projects && projects.length > 0;

  function reset() {
    setTitle("");
    setDescription("");
    setPriority(DEFAULT_PRIORITY);
    setTaskStatus("TODO");
    setPlannedMinutes(30);
    setAssignees(new Set([defaultAssigneeId ?? members[0]?.id].filter(Boolean) as string[]));
    setProjectSel(presetProject);
    setDueDate(initialDueDate ?? "");
    setStartAtDate(initialStartDate ?? "");
    setStartAtTime(initialStartTime ?? "");
    setRecurring(false);
    setFrequency("WEEKLY");
    setDays(new Set(["1", "2", "3", "4", "5"]));
    setStartDate(todayStr());
    setByManager(false);
    setFromSummary(false);
  }

  // Обовʼязкові поля (пріоритет, час, дедлайн) — лише для звичайної задачі-«Зробити». Для «Ідеї» нічого не обовʼязково.
  const requiredForTask = !recurring && taskStatus !== "IDEA";

  function submit() {
    if (!title.trim()) {
      toast.error(t(locale, "dlg.enterName"));
      return;
    }
    // Однорядковий шаблон: «Назва. До ДД.ММ. Час. Пріоритет» — якщо в рядку є всі три
    // параметри, вони заповнюють поля самі, а назва очищується від службових частин.
    let fTitle = title.trim(), fPriority = priority, fPlanned = plannedMinutes, fDue = dueDate;
    if (!recurring && taskStatus !== "IDEA") {
      const q = parseTaskLine(fTitle);
      if (q && q.priority != null && q.dueISO != null && q.plannedMinutes != null) {
        const d = new Date(q.dueISO);
        const pad = (n: number) => String(n).padStart(2, "0");
        fTitle = q.title; fPriority = q.priority; fPlanned = q.plannedMinutes;
        fDue = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      }
    }
    // для «Зробити» дедлайн обовʼязковий (пріоритет і час завжди мають значення)
    if (requiredForTask && !fDue) {
      toast.error(t(locale, "dlg.requiredMissing"));
      return;
    }
    const chosenProject = showProjectSelect ? (projectSel === "base" ? undefined : projectSel) : (projectId || undefined);
    // Список виконавців: якщо виконавець зафіксований — лише він, інакше всі відмічені галочками
    const targets = lockedAssigneeId ? [lockedAssigneeId] : [...assignees];
    if (targets.length === 0) { toast.error(t(locale, "dlg.pickAssignee")); return; }
    // --- Регулярна задача ---
    if (recurring) {
      if (frequency === "WEEKLY" && days.size === 0) {
        toast.error(t(locale, "dlg.pickWeekday"));
        return;
      }
      start(async () => {
        const results = await Promise.all(targets.map((assignee) => createRecurringTask({
          assigneeId: assignee, title: title.trim(), priority, plannedMinutes,
          frequency, weekdays: frequency === "WEEKLY" ? [...days].join(",") : undefined,
          dayOfMonth: frequency === "MONTHLY" ? Number(startDate.split("-")[2]) : undefined,
          dueDayOfMonth: frequency === "MONTHLY" ? Number(recDueDate.split("-")[2]) : undefined,
          startTime: startAtTime || undefined,
          projectId: chosenProject,
        })));
        const err = results.find((r) => r?.error)?.error;
        if (err) { toast.error(err); return; }
        toast.success(targets.length > 1 ? `${t(locale, "dlg.recCreatedN")}: ${targets.length}` : t(locale, "dlg.recCreated"));
        reset(); onClose(); router.refresh();
      });
      return;
    }
    start(async () => {
      try {
        const created = await Promise.all(targets.map((assignee) => createTask({
          projectId: chosenProject,
          title: fTitle,
          description: description.trim() || undefined,
          status: taskStatus,
          priority: fPriority,
          plannedMinutes: fPlanned,
          assigneeId: assignee,
          dueDate: fDue || undefined,
          scheduledAt: startAtDate ? (startAtTime ? `${startAtDate}T${startAtTime}` : startAtDate) : undefined,
          assignedByManager: byManager || undefined,
          fromSummary: fromSummary || undefined,
        })));
        toast.success(targets.length > 1 ? `${t(locale, "dlg.createdN")}: ${targets.length}` : t(locale, "dlg.created"));
        if (onCreated && created[0]) {
          onCreated(created[0].id);
        } else {
          reset();
          onClose();
          router.refresh();
        }
      } catch {
        toast.error(t(locale, "dlg.createFailed"));
      }
    });
  }

  return (
    <Dialog open={status !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg" onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submit(); } }}>
        <DialogHeader>
          <DialogTitle>{headerTitle ?? t(locale, "dlg.newTask")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">{t(locale, "dlg.name")}</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t(locale, "dlg.taskNamePh")}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-desc">{t(locale, "dlg.description")}</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t(locale, "dlg.descriptionPh")}
              rows={2}
            />
          </div>

          {/* Приоритет 1..10, 5 по центру, сразу активны */}
          <div className="space-y-1.5">
            <Label>{t(locale, "dlg.priority")}{requiredForTask && <span className="ml-0.5 text-[#8CC63F]">*</span>}</Label>
            <div className="flex flex-wrap gap-1">
              {PRIORITY_VALUES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={cn(
                    "flex h-8 min-w-9 flex-1 items-center justify-center rounded-md border text-sm font-medium transition-all",
                    priority === p
                      ? cn(priorityStyle(p), "border-transparent ring-2 ring-offset-1 ring-ring")
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Статус: ідея / зробити (лише для звичайної задачі) */}
          {!recurring && (
            <div className="space-y-1.5">
              <Label>{t(locale, "dlg.status")}</Label>
              <div className="flex gap-2">
                {(["IDEA", "TODO"] as TaskStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setTaskStatus(s)}
                    className={cn(
                      "flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-all",
                      taskStatus === s
                        ? "border-primary bg-accent text-accent-foreground"
                        : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {taskStatusLabel(locale, s)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Тип задачі: звичайна / регулярна */}
          <div className="space-y-1.5">
            <Label>{t(locale, "dlg.type")}</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRecurring(false)}
                className={cn("flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-all",
                  !recurring ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground hover:bg-muted")}
              >
                {t(locale, "dlg.regular")}
              </button>
              <button
                type="button"
                onClick={() => setRecurring(true)}
                className={cn("flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-all",
                  recurring ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground hover:bg-muted")}
              >
                <Repeat className="mr-1 inline size-3.5" /> {t(locale, "dlg.recurring")}
              </button>
            </div>
          </div>

          {showProjectSelect && (
            <div className="space-y-1.5">
              <Label>{t(locale, "dlg.project")}</Label>
              <Select value={projectSel} onValueChange={setProjectSel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="base">{t(locale, "dlg.none")}</SelectItem>
                  {projects!.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Плановое время */}
          <div className="space-y-1.5">
            <Label>{t(locale, "dlg.plannedTime")}{requiredForTask && <span className="ml-0.5 text-[#8CC63F]">*</span>}</Label>
            <div className="flex gap-2">
              {PLANNED_MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPlannedMinutes(m)}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-1.5 text-sm font-medium transition-all",
                    plannedMinutes === m
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {plannedLabel(m, locale)}
                </button>
              ))}
              {/* Шестой — свой время в минутах */}
              <input
                type="number"
                min={1}
                step={5}
                inputMode="numeric"
                value={(PLANNED_MINUTES as readonly number[]).includes(plannedMinutes) ? "" : String(plannedMinutes || "")}
                onChange={(e) => { const v = Number(e.target.value); setPlannedMinutes(Number.isFinite(v) && v > 0 ? v : 0); }}
                placeholder={t(locale, "dlg.customMin")}
                className={cn(
                  "w-16 flex-1 rounded-md border px-2 py-1.5 text-center text-sm font-medium outline-none transition-all",
                  plannedMinutes > 0 && !(PLANNED_MINUTES as readonly number[]).includes(plannedMinutes)
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border text-muted-foreground focus:border-ring",
                )}
              />
            </div>
          </div>

          {/* Регулярність: частота + дні тижня */}
          {recurring && (
            <>
              <div className="space-y-1.5">
                <Label>{t(locale, "dlg.frequency")}</Label>
                <Select value={frequency} onValueChange={(v) => setFrequency(v as "DAILY" | "WEEKLY" | "MONTHLY")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAILY">{freqLabel(locale, "DAILY")}</SelectItem>
                    <SelectItem value="WEEKLY">{freqLabel(locale, "WEEKLY")}</SelectItem>
                    <SelectItem value="MONTHLY">{freqLabel(locale, "MONTHLY")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {frequency === "WEEKLY" && (
                <div className="space-y-1.5">
                  <Label>{t(locale, "dlg.weekdays")}</Label>
                  <div className="flex gap-1">
                    {WEEKDAYS.map(([d]) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDay(d)}
                        className={cn("flex h-8 flex-1 items-center justify-center rounded text-[11px] font-medium",
                          days.has(d) ? "bg-primary text-primary-foreground" : "border text-muted-foreground hover:bg-muted")}
                      >
                        {t(locale, `wd.${d}`)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Час старту екземплярів — одна година на всі дні розкладу (щомісячним не потрібен) */}
              {frequency !== "MONTHLY" && (
                <div className="space-y-1.5">
                  <Label>{t(locale, "dlg.startAt")}</Label>
                  <Input type="time" aria-label={t(locale, "dlg.time")} value={startAtTime} onChange={(e) => setStartAtTime(e.target.value)} className="w-40" />
                </div>
              )}
              {frequency === "MONTHLY" && (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="rec-start">{t(locale, "dlg.monthlyDate")}</Label>
                      <Input id="rec-start" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); if (recDueDate < e.target.value) setRecDueDate(e.target.value); }} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="rec-due">{t(locale, "dlg.monthlyDeadline")}</Label>
                      <Input id="rec-due" type="date" value={recDueDate} min={startDate} onChange={(e) => setRecDueDate(e.target.value)} />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {t(locale, "dlg.monthlyHint")} {Number(startDate.split("-")[2])}. {t(locale, "dlg.deadline")} — {Number(recDueDate.split("-")[2])} {t(locale, "rec.dayNo")}.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Мітки задачі */}
          {!recurring && (
            <div className="space-y-1.5">
              <Label>{t(locale, "dlg.tags")}</Label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setByManager((v) => !v)}
                  className={cn("rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                    byManager ? "border-[#E8B892] bg-[#FBE6D6] text-[#A0561F] dark:border-[#5a3a1e] dark:bg-[#33210f] dark:text-[#e2b382]" : "border-border text-muted-foreground hover:bg-muted")}
                >
                  {t(locale, "filters.byManager")}
                </button>
                <button
                  type="button"
                  onClick={() => setFromSummary((v) => !v)}
                  className={cn("rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                    fromSummary ? "border-[#c9bbec] bg-[#EDE7FA] text-[#5B47A6] dark:border-[#3a2e5c] dark:bg-[#241d3a] dark:text-[#c3b6f0]" : "border-border text-muted-foreground hover:bg-muted")}
                >
                  {t(locale, "filters.fromSummary")}
                </button>
              </div>
            </div>
          )}

          {/* Час старту (дата + час) — тільки для звичайної задачі, перед дедлайном */}
          {!recurring && (
            <div className="space-y-1.5">
              <Label>{t(locale, "dlg.startAt")}</Label>
              <div className="grid grid-cols-2 gap-3">
                <Input type="date" aria-label={t(locale, "dlg.date")} value={startAtDate} onChange={(e) => setStartAtDate(e.target.value)} />
                <Input type="time" aria-label={t(locale, "dlg.time")} value={startAtTime} onChange={(e) => setStartAtTime(e.target.value)} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {!recurring && (
              <div className="space-y-2">
                <Label htmlFor="task-due">{t(locale, "dlg.deadline")}{requiredForTask && <span className="ml-0.5 text-[#8CC63F]">*</span>}</Label>
                <Input id="task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            )}
          </div>

          {/* Виконавці — згорнутий список; розкривається лише по кліку, мультивибір галочками */}
          {!lockedAssigneeId && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>{t(locale, "dlg.assignees")}{assignees.size > 0 ? ` · ${assignees.size}` : ""}</Label>
                {assigneeOpen && (
                  <div className="flex gap-2 text-xs">
                    <button type="button" className="text-accent-foreground hover:underline" onClick={() => setAssignees(new Set(members.map((m) => m.id)))}>{t(locale, "dlg.selectAll")}</button>
                    <button type="button" className="text-muted-foreground hover:underline" onClick={() => setAssignees(new Set())}>{t(locale, "dlg.clearAll")}</button>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setAssigneeOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span className={cn("truncate", assignees.size === 0 && "text-muted-foreground")}>
                  {assignees.size === 0
                    ? t(locale, "dlg.pickAssignee")
                    : members.filter((m) => assignees.has(m.id)).map((m) => m.name).join(", ")}
                </span>
                <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", assigneeOpen && "rotate-180")} />
              </button>
              {assigneeOpen && (
                <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-md border p-1">
                  {members.map((m) => (
                    <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                      <Checkbox checked={assignees.has(m.id)} onCheckedChange={() => toggleAssignee(m.id)} />
                      <span className="flex-1 truncate">{m.name}</span>
                      {m.isActive === false && <span className="text-xs text-muted-foreground">{t(locale, "dlg.closed")}</span>}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          {recurring && <p className="text-xs text-muted-foreground">{t(locale, "dlg.recHint")}</p>}
          {requiredForTask && (
            <p className="text-[11px] leading-snug text-muted-foreground">
              <span className="text-[#8CC63F]">*</span> {t(locale, "dlg.requiredNote")}
            </p>
          )}
        </div>
        <DialogFooter className="sm:flex-col sm:items-stretch sm:gap-2">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={pending}>{cancelLabel ?? t(locale, "dlg.cancel")}</Button>
            {extraFooter}
            <Button onClick={submit} disabled={pending}>{pending ? "…" : t(locale, "dlg.create")}</Button>
          </div>
          <span className="text-right text-[10px] text-muted-foreground">{t(locale, "ntd.shortcut")}</span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
