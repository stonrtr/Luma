import Link from "next/link";
import { SourceActions } from "@/components/SourceActions";
import { fmtDuration, relTime } from "@/lib/format";
import { db } from "@/lib/db";
import { SOURCE_STATUS_LABEL, SOURCE_TYPE_LABEL, type SourceStatus, type SourceType } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_CHIP: Record<string, string> = {
  DRAFT_READY: "chip-accent",
  EDITING: "chip-accent",
  COMPLETED: "chip-green",
  ERROR: "chip-red",
};

export default async function InboxPage() {
  const sources = await db.source.findMany({
    include: { drafts: { select: { id: true }, take: 1 }, _count: { select: { knowledge: true } } },
    orderBy: { updatedAt: "desc" },
  });

  const pending = sources.filter((s) => ["DRAFT_READY", "EDITING"].includes(s.status));
  const processing = sources.filter((s) => ["NEW", "TRANSCRIBING", "ANALYZING"].includes(s.status));
  const errors = sources.filter((s) => s.status === "ERROR");
  const done = sources.filter((s) => s.status === "COMPLETED");

  const Row = ({ s }: { s: (typeof sources)[number] }) => (
    <div className="card pad row spread wrap" style={{ gap: 12 }}>
      <div style={{ minWidth: 200, flex: 1 }}>
        <div className="row wrap" style={{ gap: 8 }}>
          <span className={`chip ${STATUS_CHIP[s.status] ?? ""}`}>
            {SOURCE_STATUS_LABEL[s.status as SourceStatus]}
          </span>
          <strong>{s.title}</strong>
        </div>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          {SOURCE_TYPE_LABEL[s.type as SourceType]}
          {s.duration ? ` · ${fmtDuration(s.duration)}` : ""}
          {s._count.knowledge > 0 ? ` · ${s._count.knowledge} знаний` : ""} · {relTime(s.updatedAt.toISOString())}
        </div>
        {s.status === "ERROR" && s.error && (
          <div className="muted" style={{ fontSize: 12.5, marginTop: 4, color: "var(--red)" }}>{s.error}</div>
        )}
      </div>
      <div className="row" style={{ gap: 8 }}>
        {s.drafts[0] && ["DRAFT_READY", "EDITING"].includes(s.status) && (
          <Link href={`/drafts/${s.drafts[0].id}`} className="btn btn-sm btn-primary">
            Продолжить →
          </Link>
        )}
        {s.status === "COMPLETED" && (
          <Link href={`/sources/${s.id}`} className="btn btn-sm">
            Открыть
          </Link>
        )}
        <SourceActions sourceId={s.id} status={s.status} compact />
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Inbox</h1>
        <p className="page-sub">Необработанные материалы и черновики, ожидающие проверки</p>
      </div>

      {sources.length === 0 && (
        <div className="empty">
          <div className="empty-emoji">📥</div>
          Inbox пуст. Добавьте видео или текст через кнопку «Добавить».
        </div>
      )}

      {pending.length > 0 && (
        <Section title={`Требуют разбора · ${pending.length}`}>
          {pending.map((s) => (
            <Row key={s.id} s={s} />
          ))}
        </Section>
      )}
      {processing.length > 0 && (
        <Section title="Обрабатываются">
          {processing.map((s) => (
            <Row key={s.id} s={s} />
          ))}
        </Section>
      )}
      {errors.length > 0 && (
        <Section title="Ошибки">
          {errors.map((s) => (
            <Row key={s.id} s={s} />
          ))}
        </Section>
      )}
      {done.length > 0 && (
        <Section title="Обработаны">
          {done.map((s) => (
            <Row key={s.id} s={s} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2 className="page-sub" style={{ fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>
        {title}
      </h2>
      <div className="stack">{children}</div>
    </section>
  );
}
