import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";

// GET /api/v1/projects/:id/tasks — задачи проекта (JSON API)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;
  const member = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: session.user.id } },
  });
  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tasks = await db.task.findMany({
    where: { projectId },
    orderBy: [{ status: "asc" }, { position: "asc" }],
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      startDate: true,
      dueDate: true,
      parentId: true,
      assignees: { select: { user: { select: { id: true, name: true } } } },
    },
  });

  return NextResponse.json({ data: tasks });
}
