import * as z from "zod";

export const createUserSchema = z.object({
  name: z.string().trim().min(1, "Введите имя").max(200),
  email: z.email("Введите корректный email"),
  password: z.string().min(8, "Минимум 8 символов"),
});
