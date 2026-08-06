"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/ui/user-avatar";
import { updateAvatar } from "@/server/actions/settings";

export function AvatarForm({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  const [error, action, pending] = useActionState(updateAvatar, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <UserAvatar name={name} avatarUrl={avatarUrl} size="lg" />
        <div className="flex flex-col gap-2">
          <Label htmlFor="avatar">Фото профиля</Label>
          <Input id="avatar" name="avatar" type="file" accept="image/*" />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Сохранение..." : "Сохранить"}
      </Button>
    </form>
  );
}
