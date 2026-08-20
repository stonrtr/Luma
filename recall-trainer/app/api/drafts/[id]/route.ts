import { db } from "@/lib/db";
import { mapBlock, mapSource } from "@/lib/db-mappers";
import { bad, ok, serverError } from "@/lib/server/http";
import type { DraftDTO } from "@/lib/types";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const draft = await db.draft.findUnique({
      where: { id },
      include: {
        blocks: { orderBy: { order: "asc" } },
        source: { include: { _count: { select: { knowledge: true } } } },
      },
    });
    if (!draft) return bad("Черновик не найден", 404);
    const dto: DraftDTO = {
      id: draft.id,
      sourceId: draft.sourceId,
      status: draft.status,
      source: mapSource(draft.source),
      blocks: draft.blocks.map(mapBlock),
    };
    return ok(dto);
  } catch (e) {
    return serverError(e);
  }
}
