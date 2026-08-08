"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import SetCard from "@/components/SetCard";
import { IcCards, IcLearn, IcTest, IcMatch, IcPlus } from "@/components/icons";

export default function Home() {
  const { data, ready } = useStore();
  if (!ready) return <PageSkeleton />;

  const recents = data.recentSetIds
    .map((id) => data.sets.find((s) => s.id === id))
    .filter(Boolean)
    .slice(0, 8) as typeof data.sets;
  const popular = data.sets;

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6">
      {/* Hero */}
      <section
        className="mb-8 overflow-hidden rounded-3xl p-8 text-white"
        style={{ background: "linear-gradient(120deg,#4255ff,#7c3aed)" }}
      >
        <div className="max-w-xl">
          <h1 className="text-3xl md:text-4xl font-black leading-tight">
            Every class, every test, one ultimate study app
          </h1>
          <p className="mt-3 text-white/85">
            Create your own flashcards or find sets made by other students. Then
            study with Learn, Test, Match, and more.
          </p>
          <Link
            href="/create"
            className="qbtn mt-5 !bg-white !text-assembly font-black inline-flex"
          >
            <IcPlus size={18} /> Create a study set
          </Link>
        </div>
      </section>

      {/* Study modes strip */}
      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ModeChip icon={<IcCards />} label="Flashcards" />
        <ModeChip icon={<IcLearn />} label="Learn" />
        <ModeChip icon={<IcTest />} label="Test" />
        <ModeChip icon={<IcMatch />} label="Match" />
      </section>

      {recents.length > 0 && (
        <Section title="Recent">
          <Grid>
            {recents.map((s) => (
              <SetCard key={s.id} set={s} />
            ))}
          </Grid>
        </Section>
      )}

      <Section title="Popular study sets">
        <Grid>
          {popular.map((s) => (
            <SetCard key={s.id} set={s} />
          ))}
        </Grid>
      </Section>

      <Section title="Your folders">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.folders.map((f) => (
            <Link
              key={f.id}
              href={`/folders/${f.id}`}
              className="surface flex items-center gap-3 rounded-2xl border border-line-c p-4 hover:border-assembly"
            >
              <span className="text-2xl">📁</span>
              <div>
                <div className="font-bold text-heading-c">{f.name}</div>
                <div className="text-xs text-muted-c">{f.setIds.length} sets</div>
              </div>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}

function ModeChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="surface flex items-center gap-3 rounded-xl border border-line-c px-4 py-3">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-assembly/10 text-assembly">
        {icon}
      </span>
      <span className="font-bold text-heading-c">{label}</span>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-9">
      <h2 className="mb-3 text-xl font-black text-heading-c">{title}</h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {children}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6">
      <div className="h-48 rounded-3xl bg-canvas-c animate-pulse" />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-canvas-c animate-pulse" />
        ))}
      </div>
    </div>
  );
}
