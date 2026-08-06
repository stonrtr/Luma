import * as z from "zod";
import { RecurrenceFrequency } from "@/generated/prisma/client";

const emptyToUndefined = (value: unknown) =>
  value === "" || value === null ? undefined : value;

export const createRecurringTaskSchema = z
  .object({
    assigneeId: z.string().min(1),
    title: z.string().trim().min(1, "Введите название задачи").max(200),
    description: z.preprocess(
      emptyToUndefined,
      z.string().trim().max(5000).optional(),
    ),
    priority: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(1).max(10).default(5),
    ),
    frequency: z.enum(RecurrenceFrequency),
    weekday: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(0).max(6).optional(),
    ),
    dayOfMonth: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(1).max(31).optional(),
    ),
  })
  .refine(
    (data) => data.frequency !== "WEEKLY" || data.weekday !== undefined,
    { error: "Выберите день недели", path: ["weekday"] },
  )
  .refine(
    (data) => data.frequency !== "MONTHLY" || data.dayOfMonth !== undefined,
    { error: "Выберите число месяца", path: ["dayOfMonth"] },
  );

export const deleteRecurringTaskSchema = z.object({
  id: z.string().min(1),
});
