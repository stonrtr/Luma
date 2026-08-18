import Link from "next/link";
import { notFound } from "next/navigation";
import { getTask } from "@/server/queries/tasks";
import { getUsers } from "@/server/queries/users";
import { requireUser } from "@/server/dal";
import { TaskDetailForm } from "@/components/task/task-detail-form";
import { CommentList } from "@/components/task/comment-list";
import { CommentForm } from "@/components/task/comment-form";
import { Separator } from "@/components/ui/separator";

export default async function TaskDetailPage({
  params,
}: PageProps<"/tasks/[taskId]">) {
  const { taskId } = await params;

  const [currentUser, task, users] = await Promise.all([
    requireUser(),
    getTask(taskId),
    getUsers(),
  ]);

  if (!task) notFound();
  if (task.assigneeId !== currentUser.id && currentUser.role !== "ADMIN") {
    notFound();
  }

  const backHref =
    task.assigneeId === currentUser.id ? "/" : `/team/${task.assigneeId}`;
  const backLabel =
    task.assigneeId === currentUser.id ? "Моя доска" : task.assignee.name;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link
        href={backHref}
        className="text-sm text-muted-foreground hover:underline"
      >
        ← {backLabel}
      </Link>

      <TaskDetailForm task={task} users={users} />

      <Separator />

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Комментарии</h2>
        <CommentList comments={task.comments} />
        <CommentForm taskId={task.id} />
      </div>
    </div>
  );
}
