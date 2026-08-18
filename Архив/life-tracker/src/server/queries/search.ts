import "server-only";
import { db } from "@/server/db";
import type { SystemRole } from "@/generated/prisma/enums";

export type SearchResults = {
  tasks: { id: string; title: string; status: string; projectName: string | null }[];
  projects: { id: string; name: string; color: string }[];
  people: { id: string; name: string; title: string | null }[];
};

// Глобальный поиск, ограниченный видимостью пользователя.
// Регистронезависимо (в т.ч. кириллица) — фильтруем в приложении, т.к. SQLite
// LIKE не понимает регистр не-ASCII.
export async function searchEverything(userId: string, role: SystemRole, q: string): Promise<SearchResults> {
  const term = q.trim().toLowerCase();
  if (term.length < 2) return { tasks: [], projects: [], people: [] };
  const isAdmin = role === "OWNER" || role === "ADMIN";
  const has = (s: string | null | undefined) => (s ?? "").toLowerCase().includes(term);

  const visTask = isAdmin
    ? {}
    : { OR: [{ assignees: { some: { userId } } }, { project: { members: { some: { userId } } } }, { createdById: userId }] };
  const visProject = isAdmin ? {} : { members: { some: { userId } } };

  const [tasks, projects, people] = await Promise.all([
    db.task.findMany({
      where: { archivedAt: null, ...visTask },
      select: { id: true, title: true, status: true, project: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 400,
    }),
    db.project.findMany({
      where: { archivedAt: null, ...visProject },
      select: { id: true, name: true, color: true },
      take: 200,
    }),
    db.user.findMany({
      where: { isActive: true, role: { not: "CLIENT" } },
      select: { id: true, name: true, title: true },
      take: 200,
    }),
  ]);

  return {
    tasks: tasks.filter((t) => has(t.title)).slice(0, 8)
      .map((t) => ({ id: t.id, title: t.title, status: t.status, projectName: t.project?.name ?? null })),
    projects: projects.filter((p) => has(p.name)).slice(0, 5),
    people: people.filter((u) => has(u.name) || has(u.title)).slice(0, 5),
  };
}
