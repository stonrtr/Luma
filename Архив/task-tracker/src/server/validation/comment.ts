import * as z from "zod";

export const createCommentSchema = z.object({
  taskId: z.string().min(1),
  body: z.string().trim().min(1, "Комментарий не может быть пустым").max(3000),
});
