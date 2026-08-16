import { regenerateExamples } from "@/lib/server/translateWorker";
import { json } from "@/lib/server/http";

// Разовая пересборка примеров (короткие вместо длинных) — перезаписывает
// exampleEn/exampleRu у всех готовых карточек. Тяжёлая операция (LLM на каждую),
// поэтому вызывается вручную.
export async function POST() {
  const updated = await regenerateExamples();
  return json({ ok: true, updated });
}
