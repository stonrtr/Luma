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
          <div
            className="mx-auto mb-3 h-20 w-20 rounded-2xl bg-white bg-contain bg-center bg-no-repeat shadow-sm ring-1 ring-black/5"
            style={{ backgroundImage: "url('/logo.png')" }}
            role="img"
            aria-label="Workspace M"
          />
          <h1 className="text-2xl font-semibold tracking-tight">
            Workspace <span className="font-extrabold">M</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Войдите, чтобы управлять проектами
          </p>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
