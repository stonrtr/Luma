import { db } from "@/lib/db";
import { toRule } from "@/lib/serialize";
import { buildRule } from "@/lib/server/ruleWorker";
import { hasAnyLLM } from "@/lib/server/llm";
import { badRequest, json, readJson, str } from "@/lib/server/http";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const archived = url.searchParams.get("archived") === "true";
  const rules = await db.grammarRule.findMany({
    where: { archived },
    orderBy: { createdAt: "desc" },
    include: { exercises: { orderBy: { position: "asc" } } },
  });
  return json(rules.map(toRule));
}

export async function POST(req: Request) {
  const body = await readJson(req);
  const query = str(body.query, 300).trim();
  if (!query) return badRequest("Введите название правила");
  if (!hasAnyLLM()) return badRequest("Генерация правил недоступна — LLM не настроен");

  const rule = await db.grammarRule.create({
    data: { title: query, query, status: "pending" },
    include: { exercises: true },
  });
  void buildRule(rule.id, query);
  return json(toRule(rule), { status: 201 });
}
