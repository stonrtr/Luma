import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/dal";
import { getUser, getUsers } from "@/server/queries/users";
import { getBoardTasks, getArchivedTasks } from "@/server/queries/tasks";
import { getRecurringTasks } from "@/server/queries/recurring";
import { getBoardStats } from "@/server/queries/stats";
import { generateDueRecurringTasks } from "@/server/recurring-engine";
import { archiveOldDoneTasks } from "@/server/archive-engine";
import { KanbanBoard } from "@/components/board/kanban-board";
import { NewTaskDialog } from "@/components/board/new-task-dialog";
import { TaskStatus } from "@/generated/prisma/client";

export default async function TeamBoardPage({
  params,
}: PageProps<"/team/[userId]">) {
  await requireAdmin();
  const { userId } = await params;

  const member = await getUser(userId);
  if (!member) notFound();

  await generateDueRecurringTasks(userId);
  await archiveOldDoneTasks(userId);

  const [tasks, users, recurringTasks, stats, archivedTasks] =
    await Promise.all([
      getBoardTasks(userId),
      getUsers(),
      getRecurringTasks(userId),
      getBoardStats(userId),
      getArchivedTasks(userId),
    ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Доска: {member.name}</h1>
        <NewTaskDialog
          boardUserId={member.id}
          initialStatus={TaskStatus.TODO}
          users={users}
          triggerVariant="button"
        />
      </div>
      <KanbanBoard
        boardUserId={member.id}
        owner={{
          name: member.name,
          avatarUrl: member.avatarUrl,
          role: member.role,
        }}
        initialTasks={tasks}
        users={users}
        recurringTasks={recurringTasks}
        stats={stats}
        archivedTasks={archivedTasks}
      />
    </div>
  );
}
