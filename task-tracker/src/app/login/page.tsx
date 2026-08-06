import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border p-6 shadow-sm">
        <h1 className="mb-6 text-xl font-semibold">Вход в таск-трекер</h1>
        <LoginForm />
      </div>
    </div>
  );
}
