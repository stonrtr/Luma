import { db } from "@/lib/db";
import { mapBlock } from "@/lib/db-mappers";
import { ok, serverError } from "@/lib/server/http";

const STR_ARR_FIELDS = ["keyPoints", "terms", "examples", "takeaways"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    const data: Record<string, unknown> = { userEdited: true };

    for (const f of ["title", "summary", "content", "suggestedTopic"] as const) {
      if (typeof body[f] === "string") data[f] = body[f];
    }
    for (const f of STR_ARR_FIELDS) {
      if (Array.isArray(body[f])) {
        data[f] = JSON.stringify((body[f] as unknown[]).map((x) => String(x)));
      }
    }
    if (typeof body.selected === "boolean") data.selected = body.selected;
    if (body.topicId === null || typeof body.topicId === "string") data.topicId = body.topicId;
    if (typeof body.startTimestamp === "number" || body.startTimestamp === null)
      data.startTimestamp = body.startTimestamp;
    if (typeof body.endTimestamp === "number" || body.endTimestamp === null)
      data.endTimestamp = body.endTimestamp;

    const block = await db.draftBlock.update({ where: { id }, data });
    return ok(mapBlock(block));
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.draftBlock.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
