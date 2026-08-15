import { translatePhrase } from "@/lib/server/translate";
import { hasAnyLLM } from "@/lib/server/llm";
import { detectLanguage, normalize } from "@/lib/lang";
import { badRequest, json, readJson, str } from "@/lib/server/http";

// Preview translation for the single-add flow (§15.2) — does NOT save anything.
export async function POST(req: Request) {
  const body = await readJson(req);
  const text = normalize(str(body.text, 400));
  const englishIn = normalize(str(body.english, 400));
  const russianIn = normalize(str(body.russian, 400));

  let english = englishIn;
  let russian = russianIn;
  if (text && !english && !russian) {
    if (detectLanguage(text) === "en") english = text;
    else russian = text;
  }
  if (!english && !russian) return badRequest("Введите фразу");

  if (!hasAnyLLM()) {
    return json({ error: "no-llm", message: "Автоперевод недоступен — введите перевод вручную" }, { status: 200 });
  }

  try {
    const result = await translatePhrase({
      english: english || undefined,
      russian: russian || undefined,
      sourceLanguage: english ? "en" : "ru",
    });
    return json(result);
  } catch (e) {
    return json(
      { error: "failed", message: (e as Error).message || "Перевод не удался — введите вручную" },
      { status: 200 }
    );
  }
}
