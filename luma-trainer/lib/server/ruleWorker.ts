import "server-only";
import { db } from "../db";
import { generateRule } from "./rulegen";

/** Generate a grammar rule's content + exercises in the background (§20). */
export async function buildRule(id: string, query: string): Promise<void> {
  try {
    const g = await generateRule(query);
    await db.grammarRule.update({
      where: { id },
      data: {
        title: g.title || query,
        explanation: g.explanation,
        formula: g.formula,
        uses: JSON.stringify(g.uses),
        examples: JSON.stringify(g.examples),
        markers: JSON.stringify(g.markers),
        mistakes: JSON.stringify(g.mistakes),
        comparison: g.comparison,
        status: "ready",
        dueAt: new Date(),
      },
    });
    await db.ruleExercise.deleteMany({ where: { ruleId: id } });
    for (let i = 0; i < g.exercises.length; i++) {
      const ex = g.exercises[i];
      await db.ruleExercise.create({
        data: {
          ruleId: id,
          type: ex.type,
          prompt: ex.prompt,
          answers: JSON.stringify(ex.answers),
          options: JSON.stringify(ex.options),
          explanation: ex.explanation,
          position: i,
        },
      });
    }
  } catch {
    await db.grammarRule.update({ where: { id }, data: { status: "failed" } }).catch(() => {});
  }
}
