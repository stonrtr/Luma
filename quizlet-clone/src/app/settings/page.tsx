"use client";

import { useStore } from "@/lib/store";
import { supportsSpeech } from "@/lib/speech";

export default function Settings() {
  const { data, ready, setDark, setSetting } = useStore();
  if (!ready) return <div className="p-10 text-center text-muted-c">Loading…</div>;

  const reset = () => {
    if (confirm("Reset all data back to the sample sets? This cannot be undone.")) {
      localStorage.removeItem("quizlet-clone:v1");
      location.href = "/";
    }
  };

  return (
    <div className="mx-auto max-w-[640px] px-4 py-8">
      <h1 className="text-2xl font-black text-heading-c">Settings</h1>

      <section className="surface mt-6 rounded-2xl border border-line-c divide-y divide-[color:var(--line)]">
        <Toggle
          label="Dark mode"
          desc="Switch between light and dark themes."
          on={data.settings.dark}
          onChange={setDark}
        />
        <Toggle
          label="Sound effects & pronunciation"
          desc={
            supportsSpeech()
              ? "Read terms aloud using your browser's text-to-speech."
              : "Text-to-speech isn't supported in this browser."
          }
          on={data.settings.soundOn}
          onChange={(v) => setSetting("soundOn", v)}
        />
        <Toggle
          label="Autoplay flashcards"
          desc="Automatically advance through cards."
          on={data.settings.autoplayFlashcards}
          onChange={(v) => setSetting("autoplayFlashcards", v)}
        />
      </section>

      <section className="surface mt-4 rounded-2xl border border-line-c p-5">
        <h2 className="font-black text-heading-c">Account</h2>
        <div className="mt-2 text-sm text-muted-c">
          Signed in as <b className="text-heading-c">{data.user.name}</b> (@
          {data.user.username})
        </div>
        <button className="qbtn qbtn-ghost mt-4 !text-incorrect" onClick={reset}>
          Reset all data
        </button>
      </section>

      <p className="mt-6 text-center text-xs text-muted-c">
        Quizlet clone · data stored locally in your browser
      </p>
    </div>
  );
}

function Toggle({
  label,
  desc,
  on,
  onChange,
}: {
  label: string;
  desc: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-5">
      <div>
        <div className="font-bold text-heading-c">{label}</div>
        <div className="text-sm text-muted-c">{desc}</div>
      </div>
      <button
        onClick={() => onChange(!on)}
        className={
          "relative h-7 w-12 shrink-0 rounded-full transition-colors " +
          (on ? "bg-assembly" : "bg-line-c")
        }
        aria-pressed={on}
      >
        <span
          className={
            "absolute top-1 h-5 w-5 rounded-full bg-white transition-all " +
            (on ? "left-6" : "left-1")
          }
        />
      </button>
    </div>
  );
}
