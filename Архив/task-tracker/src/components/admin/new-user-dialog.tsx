"use client";

import { useActionState, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createUser } from "@/server/actions/users";

export function NewUserDialog() {
  const [open, setOpen] = useState(false);
  const [error, action, pending] = useActionState(createUser, undefined);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>+ Пользователь</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новый пользователь</DialogTitle>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Имя</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Временный пароль</Label>
            <Input
              id="password"
              name="password"
              type="text"
              minLength={8}
              required
            />
            <p className="text-xs text-muted-foreground">
              Минимум 8 символов. Сообщите пароль пользователю лично — письмо
              не отправляется.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending}>
            {pending ? "Создание..." : "Создать"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
