import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";

// GET /api/v1/projects — проекты текущего пользователя (JSON API)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await db.project.findMany({
    where: { members: { some: { userId: session.user.id } } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      color: true,
      startDate: true,
      dueDate: true,
      budget: true,
      _count: { select: { tasks: true } },
    },
  });

  return NextResponse.json({ data: projects });
}
