import Link from "next/link";
import { AddFlow } from "@/components/AddFlow";
import { fmtDuration, relTime } from "@/lib/format";
import { db } from "@/lib/db";
import { mapKnowledge } from "@/lib/db-mappers";
import { SOURCE_STATUS_LABEL, SOURCE_TYPE_LABEL, type SourceStatus, type SourceType } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const now = new Date();
  const [needReview, dueCount, recentKnowledge, recentTopics, recentSources, totalKnowledge] =
    await Promise.all([
      db.source.findMany({
        where: { status: { in: ["DRAFT_READY", "EDITING"] } },
        include: { drafts: { select: { id: true }, take: 1 } },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
      db.card.count({ where: { dueAt: { lte: now } } }),
      db.knowledge.findMany({
        include: { topic: { include: { parent: true } }, source: true, card: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      db.topic.findMany({
        where: { parentId: null },
        include: { _count: { select: { knowledge: true } } },
        orderBy: { updatedAt: "desc" },
        take: 6,
      }),
      db.source.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
      db.knowledge.count(),
    ]);

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Главная</h1>
        <p className="page-sub">
          {totalKnowledge} знаний в базе · получил → обработал → отобрал → сохранил → нашёл → повторил
        </p>
      </div>

      <div className="card pad" style={{ marginBottom: 20 }}>
        <div className="row spread wrap">
          <div>
            <strong style={{ fontSize: 16 }}>Быстро добавить</strong>
            <p className="muted" style={{ margin: "2px 0 0", fontSize: 13.5 }}>
              Видео, статью или свою мысль
            </p>
          </div>
          <AddFlow variant="big" />
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <Link href={needReview[0]?.drafts[0] ? `/drafts/${needReview[0].drafts[0].id}` : "/inbox"} className="card pad" style={{ display: "block" }}>
          <div className="row spread">
            <strong>📥 Требуют разбора</strong>
            <span className="chip chip-accent">{needReview.length}</span>
          </div>
          <p className="muted" style={{ margin: "6px 0 0", fontSize: 13.5 }}>
            {needReview.length ? "AI подготовил черновики — проверьте и сохраните" : "Всё разобрано 🎉"}
          </p>
        </Link>
        <Link href="/review" className="card pad" style={{ display: "block" }}>
          <div className="row spread">
            <strong>🔁 Повторить сегодня</strong>
            <span className="chip chip-green">{dueCount}</span>
          </div>
          <p className="muted" style={{ margin: "6px 0 0", fontSize: 13.5 }}>
            {dueCount ? "Карточки ждут повторения" : "На сегодня всё повторено"}
          </p>
        </Link>
      </div>

      {needReview.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2 className="page-sub" style={{ fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>
            Черновики
          </h2>
          <div className="stack">
            {needReview.map((s) => (
              <Link
                key={s.id}
                href={s.drafts[0] ? `/drafts/${s.drafts[0].id}` : `/sources/${s.id}`}
                className="card pad row spread"
                style={{ display: "flex" }}
              >
                <div>
                  <strong>{s.title}</strong>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {SOURCE_TYPE_LABEL[s.type as SourceType]}
                    {s.duration ? ` · ${fmtDuration(s.duration)}` : ""}
                  </div>
                </div>
                <span className="chip chip-accent">Продолжить →</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-2">
        <section>
          <h2 className="page-sub" style={{ fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>
            Последние знания
          </h2>
          {recentKnowledge.length === 0 ? (
            <div className="card pad muted">Пока пусто — добавьте первое знание.</div>
          ) : (
            <div className="stack">
              {recentKnowledge.map((k) => {
                const dto = mapKnowledge(k);
                return (
                  <Link key={k.id} href={`/knowledge/${k.id}`} className="card pad" style={{ display: "block" }}>
                    <strong>{dto.title}</strong>
                    <div className="row wrap" style={{ gap: 6, marginTop: 5 }}>
                      {dto.topicPath && <span className="chip">{dto.topicPath}</span>}
                      <span className="faint" style={{ fontSize: 12 }}>{relTime(dto.createdAt)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="page-sub" style={{ fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>
            Темы
          </h2>
          {recentTopics.length === 0 ? (
            <div className="card pad muted">Темы появятся после сохранения знаний.</div>
          ) : (
            <div className="stack">
              {recentTopics.map((t) => (
                <Link key={t.id} href={`/topics?open=${t.id}`} className="card pad row spread" style={{ display: "flex" }}>
                  <strong>🗂 {t.name}</strong>
                  <span className="chip">{t._count.knowledge}</span>
                </Link>
              ))}
            </div>
          )}
          <h2 className="page-sub" style={{ fontWeight: 700, color: "var(--text)", margin: "22px 0 10px" }}>
            Недавние источники
          </h2>
          <div className="stack">
            {recentSources.map((s) => (
              <Link key={s.id} href={`/sources/${s.id}`} className="card pad" style={{ display: "block" }}>
                <div className="row spread">
                  <strong style={{ fontSize: 14 }}>{s.title}</strong>
                  <span className="chip">{SOURCE_STATUS_LABEL[s.status as SourceStatus]}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
