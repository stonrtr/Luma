"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/server/auth";

export async function loginAction(_prev: unknown, formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Неверный email или пароль" };
    }
    throw error;
  }
  return { error: null };
}
