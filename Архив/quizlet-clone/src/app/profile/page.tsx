"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { SetCardMini } from "@/components/SetCard";
import { IcBolt, IcSettings } from "@/components/icons";

export default function Profile() {
  const { data, ready } = useStore();
  if (!ready) return <div className="p-10 text-center text-muted-c">Loading…</div>;

  const mine = data.sets.filter((s) => s.authorId === data.user.id);
  const totalTerms = mine.reduce((n, s) => n + s.terms.length, 0);
  const mastered = Object.values(data.stats).reduce(
    (n, st) => n + Object.values(st.learn).filter((l) => l.box >= 2).length,
    0
  );

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8">
      <div className="flex items-center gap-4">
        <span
          className="grid h-20 w-20 place-items-center rounded-full text-white text-3xl font-black"
          style={{ background: data.user.avatarColor }}
        >
          {data.user.name[0]?.toUpperCase()}
        </span>
        <div>
          <h1 className="text-2xl font-black text-heading-c">{data.user.name}</h1>
          <p className="text-muted-c">@{data.user.username}</p>
          <div className="mt-1 flex items-center gap-1 text-sm font-bold text-star">
            <IcBolt size={16} /> {data.user.streak}-day streak
          </div>
        </div>
        <Link href="/settings" className="qbtn qbtn-ghost ml-auto">
          <IcSettings size={18} /> Settings
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <Stat label="Study sets" value={mine.length} />
        <Stat label="Terms" value={totalTerms} />
        <Stat label="Mastered" value={mastered} />
      </div>

      <h2 className="mt-8 mb-3 text-xl font-black text-heading-c">Your study sets</h2>
      <div className="space-y-2">
        {mine.length === 0 && (
          <p className="text-muted-c">No sets yet.</p>
        )}
        {mine.map((s) => (
          <SetCardMini key={s.id} set={s} />
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface rounded-2xl border border-line-c p-4 text-center">
      <div className="text-3xl font-black text-assembly">{value}</div>
      <div className="text-sm text-muted-c">{label}</div>
    </div>
  );
}
