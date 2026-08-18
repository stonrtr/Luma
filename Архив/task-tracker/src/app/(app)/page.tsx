import { requireUser } from "@/server/dal";
import { getBoardTasks, getArchivedTasks } from "@/server/queries/tasks";
import { getUser, getUsers } from "@/server/queries/users";
import { getRecurringTasks } from "@/server/queries/recurring";
import { getBoardStats } from "@/server/queries/stats";
import { generateDueRecurringTasks } from "@/server/recurring-engine";
import { archiveOldDoneTasks } from "@/server/archive-engine";
import { KanbanBoard } from "@/components/board/kanban-board";
import { NewTaskDialog } from "@/components/board/new-task-dialog";
import { TaskStatus } from "@/generated/prisma/client";

export default async function MyBoardPage() {
  const session = await requireUser();

  await generateDueRecurringTasks(session.id);
  await archiveOldDoneTasks(session.id);

  const [me, tasks, users, recurringTasks, stats, archivedTasks] =
    await Promise.all([
      getUser(session.id),
      getBoardTasks(session.id),
      getUsers(),
      getRecurringTasks(session.id),
      getBoardStats(session.id),
      getArchivedTasks(session.id),
    ]);

  const owner = {
    name: me?.name ?? session.name ?? "",
    avatarUrl: me?.avatarUrl ?? null,
    role: me?.role ?? session.role,
  };

  // Members without subordinates can only assign tasks to themselves.
  const isAdmin = (me?.role ?? session.role) === "ADMIN";
  const assignableUsers = isAdmin
    ? users
    : users.filter((u) => u.id === session.id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Моя доска</h1>
        <NewTaskDialog
          boardUserId={session.id}
          initialStatus={TaskStatus.TODO}
          users={assignableUsers}
          triggerVariant="button"
        />
      </div>
      <KanbanBoard
        boardUserId={session.id}
        owner={owner}
        initialTasks={tasks}
        users={assignableUsers}
        recurringTasks={recurringTasks}
        stats={stats}
        archivedTasks={archivedTasks}
      />
    </div>
  );
}
