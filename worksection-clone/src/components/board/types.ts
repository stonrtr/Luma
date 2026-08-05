import type { TaskStatus, TaskPriority } from "@/generated/prisma/enums";

export type BoardAssignee = { id: string; name: string };

export type BoardTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  position: number;
  assignees: BoardAssignee[];
  tags: { id: string; name: string; color: string }[];
  subtaskCount: number;
  commentCount: number;
  checklistTotal: number;
  checklistDone: number;
};

export type BoardMember = { id: string; name: string };
