import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
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
          <h1 className="text-2xl font-semibold tracking-tight">Сброс пароля</h1>
          <p className="mt-1 text-sm text-muted-foreground">Укажите email — пришлём ссылку для нового пароля</p>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <ForgotPasswordForm />
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link href="/login" className="underline underline-offset-2 hover:text-foreground">← Вернуться ко входу</Link>
        </p>
      </div>
    </div>
  );
}
