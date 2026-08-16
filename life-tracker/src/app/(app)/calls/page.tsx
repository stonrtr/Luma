import { requireUser } from "@/server/dal";
import { t } from "@/lib/i18n";
import { getCallBoard } from "@/server/queries/calls";
import { CallPointsPanel } from "@/components/calls/call-points-panel";
import { SummaryExtractor } from "@/components/calls/summary-extractor";
import { ListChecks, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CallsPage() {
  const user = await requireUser();
  const members = await getCallBoard(user.id);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t(user.locale, "calls.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t(user.locale, "calls.subtitle")}</p>

      <section className="mt-6">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
          <ListChecks className="size-4 text-accent-foreground" /> {t(user.locale, "calls.pointsHeader")}
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">{t(user.locale, "calls.pointsHint")}</p>
        <CallPointsPanel members={members} />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="size-4 text-accent-foreground" /> {t(user.locale, "calls.tasksHeader")}
        </h2>
        <div className="rounded-xl border bg-card p-5">
          <SummaryExtractor viewerId={user.id} />
        </div>
      </section>
    </div>
  );
}
