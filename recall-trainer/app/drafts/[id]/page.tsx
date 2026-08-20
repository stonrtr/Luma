import { notFound } from "next/navigation";
import { DraftEditor } from "@/components/DraftEditor";
import { db } from "@/lib/db";
import { mapBlock, mapSource } from "@/lib/db-mappers";
import type { DraftDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const draft = await db.draft.findUnique({
    where: { id },
    include: {
      blocks: { orderBy: { order: "asc" } },
      source: { include: { _count: { select: { knowledge: true } } } },
    },
  });
  if (!draft) notFound();

  const dto: DraftDTO = {
    id: draft.id,
    sourceId: draft.sourceId,
    status: draft.status,
    source: mapSource(draft.source),
    blocks: draft.blocks.map(mapBlock),
  };
  return <DraftEditor draft={dto} />;
}
