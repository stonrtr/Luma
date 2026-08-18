"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { speak } from "@/lib/speech";
import {
  IcCards,
  IcLearn,
  IcTest,
  IcMatch,
  IcGravity,
  IcSpell,
  IcStar,
  IcSound,
  IcEdit,
  IcTrash,
} from "@/components/icons";

export default function SetDetail() {
  const { setId } = useParams<{ setId: string }>();
  const router = useRouter();
  const { getSet, ready, toggleStar, deleteSet, data, statsFor } = useStore();
  const set = getSet(setId);

  if (!ready) return <div className="p-10 text-center text-muted-c">Loading…</div>;
  if (!set)
    return (
      <div className="mx-auto max-w-2xl p-16 text-center">
        <h1 className="text-2xl font-black text-heading-c">Set not found</h1>
        <Link href="/" className="qbtn qbtn-primary mt-4 inline-flex">
          Back home
        </Link>
      </div>
    );

  const stats = statsFor(set.id);
  const mastered = Object.values(stats.learn).filter((x) => x.box >= 2).length;
  const modes = [
    { href: "flashcards", label: "Flashcards", icon: <IcCards /> },
    { href: "learn", label: "Learn", icon: <IcLearn /> },
    { href: "test", label: "Test", icon: <IcTest /> },
    { href: "match", label: "Match", icon: <IcMatch /> },
    { href: "gravity", label: "Blast", icon: <IcGravity /> },
    { href: "spell", label: "Spell", icon: <IcSpell /> },
  ];

  return (
    <div className="mx-auto max-w-[860px] px-4 py-6">
      <h1 className="text-3xl font-black text-heading-c">{set.title}</h1>
      {set.description && (
        <p className="mt-2 text-body-c">{set.description}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-c">
        <span className="rounded-full bg-canvas-c px-3 py-1 font-bold text-body-c">
          {set.terms.length} terms
        </span>
        <span>Created by {set.authorName}</span>
        {mastered > 0 && (
          <span className="text-correct font-bold">{mastered} mastered</span>
        )}
      </div>

      {/* Study modes */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {modes.map((m) => (
          <Link
            key={m.href}
            href={`/${set.id}/${m.href}`}
            className="surface flex items-center gap-3 rounded-xl border border-line-c px-4 py-4 font-bold text-heading-c hover:border-assembly hover:bg-assembly/5"
          >
            <span className="text-assembly">{m.icon}</span>
            {m.label}
          </Link>
        ))}
      </div>

      {/* Owner actions */}
      {set.authorId === data.user.id && (
        <div className="mt-5 flex gap-2">
          <Link href={`/create?edit=${set.id}`} className="qbtn qbtn-ghost">
            <IcEdit size={18} /> Edit
          </Link>
          <button
            className="qbtn qbtn-ghost !text-incorrect"
            onClick={() => {
              if (confirm("Delete this set?")) {
                deleteSet(set.id);
                router.push("/");
              }
            }}
          >
            <IcTrash size={18} /> Delete
          </button>
        </div>
      )}

      {/* Term list */}
      <div className="mt-9">
        <h2 className="mb-3 text-xl font-black text-heading-c">
          Terms in this set ({set.terms.length})
        </h2>
        <div className="space-y-2">
          {set.terms.map((t) => (
            <div
              key={t.id}
              className="surface flex items-center gap-4 rounded-xl border border-line-c p-4"
            >
              <div className="w-1/3 min-w-[120px] font-bold text-heading-c">
                {t.term}
              </div>
              <div className="flex-1 text-body-c border-l border-line-c pl-4">
                {t.definition}
              </div>
              {t.termImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.termImage}
                  alt=""
                  className="h-12 w-12 rounded object-cover"
                />
              )}
              <div className="flex items-center gap-1">
                <button
                  className="grid h-8 w-8 place-items-center rounded-full text-muted-c hover:bg-canvas-c"
                  onClick={() => speak(t.term, set.termLang, data.settings.soundOn)}
                  aria-label="Play audio"
                >
                  <IcSound size={18} />
                </button>
                <button
                  className={
                    "grid h-8 w-8 place-items-center rounded-full hover:bg-canvas-c " +
                    (t.starred ? "text-star" : "text-muted-c")
                  }
                  onClick={() => toggleStar(set.id, t.id)}
                  aria-label="Star term"
                >
                  <IcStar size={18} filled={t.starred} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
