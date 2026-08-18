import * as z from "zod";
import { TaskStatus } from "@/generated/prisma/client";

const emptyToUndefined = (value: unknown) =>
  value === "" ? undefined : value;

const priority = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().min(1).max(10).default(5),
);

export const createTaskSchema = z.object({
  assigneeId: z.string().min(1, "Выберите ответственного"),
  title: z.string().trim().min(1, "Введите название задачи").max(200),
  description: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(5000).optional(),
  ),
  status: z.enum(TaskStatus).default(TaskStatus.IDEA),
  priority,
  dueDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
});

export const updateTaskSchema = z.object({
  taskId: z.string().min(1),
  title: z.string().trim().min(1, "Введите название задачи").max(200),
  description: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(5000).optional(),
  ),
  status: z.enum(TaskStatus),
  priority,
  dueDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  assigneeId: z.string().min(1, "Выберите ответственного"),
});

export const moveTaskSchema = z.object({
  taskId: z.string().min(1),
  toStatus: z.enum(TaskStatus),
  orderedTaskIds: z.array(z.string().min(1)).min(1),
});

export const bulkCloseSchema = z.object({
  taskIds: z.array(z.string().min(1)).min(1),
});
