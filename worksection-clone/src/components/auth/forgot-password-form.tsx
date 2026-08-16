"use client";

import { useState, useTransition } from "react";
import { requestPasswordReset } from "@/server/actions/password-reset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  if (sent) {
    return (
      <p className="text-sm">
        Если такой email зарегистрирован — мы отправили на него письмо со ссылкой.
        Проверьте входящие (и «Спам»). Ссылка действует 1 час.
      </p>
    );
  }
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => { e.preventDefault(); start(async () => { await requestPasswordReset(email); setSent(true); }); }}
    >
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Отправка…" : "Прислать ссылку"}
      </Button>
    </form>
  );
}
