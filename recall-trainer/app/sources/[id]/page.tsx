import Link from "next/link";
import { notFound } from "next/navigation";
import { fmtDuration } from "@/lib/format";
import { db } from "@/lib/db";
import { jsonSegments } from "@/lib/db-mappers";
import { formatTimecode } from "@/lib/server/youtube";
import { SOURCE_STATUS_LABEL, SOURCE_TYPE_LABEL, type SourceStatus, type SourceType } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SourceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await db.source.findUnique({
    where: { id },
    include: {
      drafts: { select: { id: true, status: true }, take: 1 },
      knowledge: {
        orderBy: { sourceStart: "asc" },
        select: { id: true, title: true, sourceStart: true, sourceEnd: true },
      },
    },
  });
  if (!s) notFound();

  const segments = jsonSegments(s.segments);
  const yt = (sec: number) => `${s.url}${s.url?.includes("?") ? "&" : "?"}t=${sec}s`;

  return (
    <div>
      <Link href="/sources" className="btn btn-ghost btn-sm" style={{ marginBottom: 14 }}>
        ← Источники
      </Link>

      <div className="row wrap spread" style={{ gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div className="row wrap" style={{ gap: 8, marginBottom: 8 }}>
            <span className="chip chip-accent">{SOURCE_TYPE_LABEL[s.type as SourceType]}</span>
            <span className="chip">{SOURCE_STATUS_LABEL[s.status as SourceStatus]}</span>
          </div>
          <h1 className="page-title">{s.title}</h1>
          <p className="page-sub">
            {s.author ? `${s.author} · ` : ""}
            {s.duration ? `${fmtDuration(s.duration)} · ` : ""}
            {s.publishedAt ? new Date(s.publishedAt).toLocaleDateString("ru") : ""}
          </p>
          <div className="row" style={{ marginTop: 10 }}>
            {s.url && (
              <a href={s.url} target="_blank" rel="noreferrer" className="btn btn-sm">▶️ Открыть оригинал</a>
            )}
            {s.drafts[0] && ["DRAFT_READY", "EDITING"].includes(s.status) && (
              <Link href={`/drafts/${s.drafts[0].id}`} className="btn btn-sm btn-primary">Открыть черновик</Link>
            )}
          </div>
        </div>
        {s.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.thumbnail} alt="" style={{ width: 220, borderRadius: 12, border: "1px solid var(--border)" }} />
        )}
      </div>

      <div className="divider" style={{ margin: "22px 0" }} />

      <div className="split">
        {/* Слева — оригинал (§45) */}
        <div className="card pad">
          <h3 style={{ marginTop: 0 }}>Оригинал</h3>
          {segments.length > 0 ? (
            <div className="transcript">
              {segments.map((seg, i) => (
                <div key={i} className="seg">
                  <a href={yt(seg.start)} target="_blank" rel="noreferrer" className="tc">
                    {formatTimecode(seg.start)}
                  </a>
                  <span>{seg.text}</span>
                </div>
              ))}
            </div>
          ) : s.rawContent ? (
            <div className="transcript" style={{ whiteSpace: "pre-wrap" }}>{s.rawContent}</div>
          ) : (
            <p className="muted">Оригинальный текст недоступен.</p>
          )}
        </div>

        {/* Справа — знания из этого источника */}
        <div className="card pad">
          <h3 style={{ marginTop: 0 }}>Знания из источника · {s.knowledge.length}</h3>
          {s.knowledge.length === 0 ? (
            <p className="muted">
              {s.drafts[0]
                ? "Черновик ещё не сохранён — откройте его и выберите темы."
                : "Из этого источника пока не сохранено знаний."}
            </p>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              {s.knowledge.map((k) => (
                <Link key={k.id} href={`/knowledge/${k.id}`} className="card pad" style={{ display: "block", boxShadow: "none" }}>
                  <div className="row spread">
                    <strong style={{ fontSize: 14 }}>{k.title}</strong>
                    {k.sourceStart != null && (
                      <span className="tc">{formatTimecode(k.sourceStart)}</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
