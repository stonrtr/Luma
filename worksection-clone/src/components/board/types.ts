import type { TaskStatus } from "@/generated/prisma/enums";

export type BoardAssignee = { id: string; name: string };

export type BoardTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: number;
  dueDate: string | null;
  position: number;
  assignedByManager: boolean;
  plannedMinutes: number | null;
  isProject: boolean;
  assignees: BoardAssignee[];
  tags: { id: string; name: string; color: string }[];
  subtaskCount: number;
  commentCount: number;
  checklistTotal: number;
  checklistDone: number;
};

export type BoardMember = { id: string; name: string };
