import { requireUser } from "@/server/dal";
import { getOrCreatePersonalProject, getLifeTasks, getLifeRecurring } from "@/server/queries/life";
import { SphereBoard, type Sphere } from "@/components/life/sphere-board";
import type { RecurringItem } from "@/components/life/recurring-manager";
import type { BoardTask } from "@/components/board/types";

export const dynamic = "force-dynamic";

export default async function LifePage() {
  const user = await requireUser();
  const project = await getOrCreatePersonalProject(user.id);
  const [rawTasks, rawRecurring] = await Promise.all([
    getLifeTasks(project.id),
    getLifeRecurring(user.id, project.id),
  ]);

  const spheres: Sphere[] = project.tags.map((t) => ({ id: t.id, name: t.name, color: t.color }));
  const sphereIds = new Set(spheres.map((s) => s.id));

  const tasks = rawTasks.map((t) => {
    const sphereTag = t.tags.find((tt) => sphereIds.has(tt.tag.id));
    const boardTask: BoardTask & { sphereId: string | null } = {
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: (t.scheduledAt ?? t.dueDate)?.toISOString() ?? null,
      position: t.position,
      assignedByManager: t.assignedByManager,
      plannedMinutes: t.plannedMinutes,
      isProject: true,
      projectName: null,
      projectColor: null,
      assignees: t.assignees.map((a) => ({ id: a.user.id, name: a.user.name })),
      tags: t.tags.map((tt) => ({ id: tt.tag.id, name: tt.tag.name, color: tt.tag.color })),
      subtaskCount: t._count.subtasks,
      commentCount: t._count.comments,
      checklistTotal: t._count.checklist,
      checklistDone: t.checklist.filter((c) => c.done).length,
      sphereId: sphereTag?.tag.id ?? null,
    };
    return boardTask;
  });

  const recurringIds = rawTasks.filter((t) => t.recurringTaskId).map((t) => t.id);

  const recurring: RecurringItem[] = rawRecurring.map((r) => ({
    id: r.id,
    title: r.title,
    frequency: r.frequency,
    weekdays: r.weekdays,
    dayOfMonth: r.dayOfMonth,
    priority: r.priority,
    tag: r.tag ? { name: r.tag.name, color: r.tag.color } : null,
  }));

  const activeCount = tasks.filter((t) => t.status !== "DONE").length;

  return (
    <div className="flex flex-col">
      <header className="border-b px-6 py-3">
        <h1 className="text-lg font-semibold">Моя жизнь</h1>
        <p className="text-sm text-muted-foreground">
          Личный планер по сферам жизни · {activeCount} активных задач
        </p>
      </header>
      <div className="px-6 py-4">
        <SphereBoard
          projectId={project.id}
          spheres={spheres}
          initialTasks={tasks}
          recurring={recurring}
          recurringIds={recurringIds}
        />
      </div>
    </div>
  );
}
