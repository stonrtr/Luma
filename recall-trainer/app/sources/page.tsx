import Link from "next/link";
import { SourceActions } from "@/components/SourceActions";
import { fmtDuration, relTime } from "@/lib/format";
import { db } from "@/lib/db";
import { SOURCE_STATUS_LABEL, SOURCE_TYPE_LABEL, type SourceStatus, type SourceType } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const sources = await db.source.findMany({
    include: { drafts: { select: { id: true }, take: 1 }, _count: { select: { knowledge: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Источники</h1>
        <p className="page-sub">Оригиналы материалов. Один источник → много знаний.</p>
      </div>

      {sources.length === 0 ? (
        <div className="empty">
          <div className="empty-emoji">🎬</div>
          Источников пока нет.
        </div>
      ) : (
        <div className="stack">
          {sources.map((s) => (
            <div key={s.id} className="card pad row spread wrap" style={{ gap: 12 }}>
              <Link href={`/sources/${s.id}`} style={{ flex: 1, minWidth: 220 }}>
                <div className="row wrap" style={{ gap: 8 }}>
                  <span className="chip">{SOURCE_TYPE_LABEL[s.type as SourceType]}</span>
                  <strong>{s.title}</strong>
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  {s.author ? `${s.author} · ` : ""}
                  {SOURCE_STATUS_LABEL[s.status as SourceStatus]}
                  {s.duration ? ` · ${fmtDuration(s.duration)}` : ""} · {s._count.knowledge} знаний · {relTime(s.createdAt.toISOString())}
                </div>
              </Link>
              <div className="row">
                {s.drafts[0] && ["DRAFT_READY", "EDITING"].includes(s.status) && (
                  <Link href={`/drafts/${s.drafts[0].id}`} className="btn btn-sm btn-primary">Черновик</Link>
                )}
                <SourceActions sourceId={s.id} status={s.status} compact />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
