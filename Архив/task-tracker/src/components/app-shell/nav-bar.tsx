import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SignOutButton } from "@/components/app-shell/sign-out-button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Logo } from "@/components/app-shell/logo";
import type { Role } from "@/generated/prisma/client";

export function NavBar({
  user,
}: {
  user: { name: string; avatarUrl: string | null; role: Role };
}) {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Logo />
          <Link href="/" className="text-muted-foreground hover:text-foreground">
            Моя доска
          </Link>
          {user.role === "ADMIN" && (
            <Link
              href="/admin/users"
              className="text-muted-foreground hover:text-foreground"
            >
              Команда
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/settings" aria-label="Настройки профиля">
            <UserAvatar name={user.name} avatarUrl={user.avatarUrl} />
          </Link>
          <span className="text-sm">{user.name}</span>
          <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
            {user.role === "ADMIN" ? "Админ" : "Участник"}
          </Badge>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
