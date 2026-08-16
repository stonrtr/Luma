"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Settings, LogOut } from "lucide-react";
import { signOutAction } from "@/server/actions/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/format";
import { t } from "@/lib/i18n";

export function UserMenu({
  name, title, email, avatarUrl, locale,
}: {
  name: string; title: string | null; email: string; avatarUrl: string | null; locale: string;
}) {
  const [, start] = useTransition();
  const item = "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md p-1 hover:bg-muted">
        <Avatar className="size-8">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
          <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="hidden min-w-0 text-left md:block">
          <p className="truncate text-sm font-medium leading-tight">{name}</p>
          <p className="truncate text-xs text-muted-foreground leading-tight">{title ?? email}</p>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="border-b px-2 py-2">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </div>
        <div className="pt-1">
          <DropdownMenuItem asChild className={item}>
            <Link href="/settings"><Settings className="size-4 text-muted-foreground" />{t(locale, "settings.title")}</Link>
          </DropdownMenuItem>
          <DropdownMenuItem className={item} onSelect={() => start(() => signOutAction())}>
            <LogOut className="size-4 text-muted-foreground" />{t(locale, "nav.signout")}
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
