import { requireUser } from "@/server/dal";
import { getUser } from "@/server/queries/users";
import { NavBar } from "@/components/app-shell/nav-bar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireUser();
  const me = await getUser(session.id);

  return (
    <div className="flex min-h-screen flex-col">
      <NavBar
        user={{
          name: me?.name ?? session.name ?? session.email ?? "",
          avatarUrl: me?.avatarUrl ?? null,
          role: session.role,
        }}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
