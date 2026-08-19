import { db } from "@/lib/db";
import { ok, serverError } from "@/lib/server/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as { orderedIds?: string[] };
    const ids = body.orderedIds ?? [];
    await db.$transaction(
      ids.map((blockId, i) =>
        db.draftBlock.updateMany({ where: { id: blockId, draftId: id }, data: { order: i } })
      )
    );
    return ok({ reordered: true });
  } catch (e) {
    return serverError(e);
  }
}
