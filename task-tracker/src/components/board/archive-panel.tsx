"use client";

import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "@/components/task/priority-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { formatDateTime } from "@/lib/format";
import { restoreTask } from "@/server/actions/tasks";

type ArchivedTask = {
  id: string;
  title: string;
  priority: number;
  archivedAt: Date | null;
  assignee: { name: string; avatarUrl: string | null };
};

export function ArchivePanel({ tasks }: { tasks: ArchivedTask[] }) {
  async function handleRestore(id: string) {
    try {
      await restoreTask({ id });
    } catch {
      toast.error("Не удалось восстановить задачу");
    }
  }

  if (tasks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Архив пуст. Задачи попадают сюда автоматически через 7 дней после
        перехода в статус «Зроблено».
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {tasks.map((task) => (
        <Card key={task.id} className="py-3">
          <CardHeader className="flex-row items-center justify-between gap-2 px-3 space-y-0">
            <CardTitle className="text-sm font-medium">
              <Link href={`/tasks/${task.id}`} className="hover:underline">
                {task.title}
              </Link>
            </CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleRestore(task.id)}
            >
              Восстановить
            </Button>
          </CardHeader>
          <CardContent className="flex items-center gap-2 px-3 text-sm text-muted-foreground">
            <PriorityBadge priority={task.priority} />
            <UserAvatar name={task.assignee.name} avatarUrl={task.assignee.avatarUrl} />
            {task.archivedAt && (
              <span>В архиве с {formatDateTime(task.archivedAt)}</span>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
