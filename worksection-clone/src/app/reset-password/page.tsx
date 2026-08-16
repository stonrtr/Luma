import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
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
          <h1 className="text-2xl font-semibold tracking-tight">Новый пароль</h1>
          <p className="mt-1 text-sm text-muted-foreground">Придумайте новый пароль для входа</p>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          {token
            ? <ResetPasswordForm token={token} />
            : <p className="text-sm text-destructive">В ссылке нет токена. Откройте ссылку из письма целиком или запросите сброс заново.</p>}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link href="/login" className="underline underline-offset-2 hover:text-foreground">← Вернуться ко входу</Link>
        </p>
      </div>
    </div>
  );
}
