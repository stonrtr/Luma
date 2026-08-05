import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/dal";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
            W
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Worksection Clone</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Войдите, чтобы управлять проектами
          </p>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Демо-доступ уже подставлен в форму
        </p>
      </div>
    </div>
  );
}
