# Quizlet clone

A faithful clone of Quizlet built with **Next.js 16 (App Router) + TypeScript + Tailwind v4**.
All data is stored locally in the browser (`localStorage`) — no backend or account required.

## Run

```bash
cd quizlet-clone
npm install
npm run dev -- -p 3200
```

Open http://localhost:3200

## Features

### Study modes (all working, keyboard-enabled)
- **Flashcards** — 3D flip, shuffle, autoplay, star, sort into *Known / Still learning*, TTS, ← → / Space shortcuts
- **Learn** — adaptive rounds with Leitner-style spaced repetition; multiple-choice for new terms, written recall for familiar ones; per-term mastery tracking + round summaries
- **Test** — configurable question count and types (written, multiple choice, true/false, matching); auto-graded with a score
- **Match** — tap-to-pair grid against the clock, 1s penalty for misses, best-time high score
- **Blast** — Gravity-style arcade game: falling terms, type the answer to blast them, lives + levels + high score
- **Spell** — listen (TTS) and type the term, with correction feedback

### Content & organization
- Create / edit / delete study sets
- Bulk **import** terms (tab / comma / semicolon / `-` delimited)
- Per-set term & definition **languages** for pronunciation
- **Folders**, **Classes**, and a searchable library
- Global **search** across titles, descriptions, and card contents
- **Profile** with study stats and streak

### Design & integrations
- Pixel-faithful Quizlet UI: Assembly-blue palette, rounded cards, typographic hierarchy
- **Dark mode** toggle
- **Web Speech API** text-to-speech for pronunciation
- Fully responsive with a mobile nav
- Star/favorite terms, progress bars, and mastery indicators

## Architecture
- `src/lib/store.tsx` — React context state manager persisted to `localStorage`
- `src/lib/types.ts` — data model (sets, terms, folders, classes, stats)
- `src/lib/seed.ts` — sample content
- `src/lib/speech.ts` — TTS integration
- `src/app/[setId]/*` — study-mode routes
- `src/components/*` — shared UI (Navbar, SetCard, StudyHeader, icons)
