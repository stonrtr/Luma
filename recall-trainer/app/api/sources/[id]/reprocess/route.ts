import { ok, serverError } from "@/lib/server/http";
import { processSource } from "@/lib/server/process";

export const maxDuration = 120;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await processSource(id);
    if (result.ok) return ok({ draftId: result.draftId });
    return ok({ needTranscript: result.reason === "NEED_TRANSCRIPT", error: result.message });
  } catch (e) {
    return serverError(e);
  }
}
