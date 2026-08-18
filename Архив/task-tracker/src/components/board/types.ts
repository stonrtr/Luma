import type { TaskStatus } from "@/generated/prisma/client";

export type BoardTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: number;
  dueDate: Date | null;
  assignee: { id: string; name: string; avatarUrl: string | null };
};
