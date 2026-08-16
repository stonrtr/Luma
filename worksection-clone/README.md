# team M Workspace

A team work-management app inspired by Worksection — tasks, weekly planning with KPIs,
call prep, and a configurable notification system. Built as a full-stack Next.js app.

Demo login (after seeding): `admin@workspacem.local` / `Password1!`

## Tech stack

- **Next.js 16** (App Router, Server Components + Server Actions) · **React 19** · **TypeScript**
- **Prisma 7** with driver adapters — SQLite for local dev, PostgreSQL for production
- **Tailwind CSS v4** · shadcn-style UI components
- **NextAuth v5** (credentials) for auth
- **web-push** (VAPID) for browser push · Telegram bot for chat notifications
- **Vitest** for unit tests
- i18n: Ukrainian / Russian / English

## Features

- **Tasks** — Kanban / by-day / calendar / archive views, priority 1–10, statuses,
  planned time, checklists, dependencies, comments with @mentions, per-task review flow
  (approve / return with a required reason).
- **Planning** — monthly KPIs, weekly priorities → tasks, and **weekly wins** (recorded
  from Friday, then archived and editable).
- **Calls** — counterparties (contacts) with discussion topics, bulk-close, per-contact
  topic archive grouped by month; AI task extraction from a call summary.
- **Notifications** — in-app toast (live polling + sound) + bell history + Telegram,
  with an admin hub to control *what / when / where / under which conditions* to send.
  Scheduled morning plan and evening summary via a cron endpoint.
- **Org chart**, **team workload**, **files**, **reports**, personal **scratchpad**,
  keyboard shortcuts (`1–7` tabs, `z` new task, `x` notes) and an in-app help dialog.
- Timezone-aware scheduling, centralized permission checks, CLIENT-role isolation.

## Getting started

```bash
npm install
cp .env.example .env          # fill in the secrets you need (see below)
npm run db:push               # create the SQLite schema (dev.db)
npm run db:seed               # demo users + sample data
npm run dev                   # http://localhost:3100
```

### Environment

`DATABASE_URL` selects the Prisma adapter by scheme: `file:./dev.db` (SQLite, default for
dev) or `postgres://…` (production). Everything else is optional and only enables the
matching feature:

| Var | Purpose |
| --- | --- |
| `AUTH_SECRET` | NextAuth session secret |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | web-push |
| `TELEGRAM_BOT_TOKEN` | Telegram notifications + wizard |
| `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` | AI task extraction (falls back to a heuristic) |
| `CRON_SECRET` | protects `GET /api/cron/run` in production |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Calendar sync (optional) |

See `.env.example` for the full list. Real `.env` files and `dev.db` are gitignored.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | dev server on port 3100 |
| `npm run build` / `npm start` | production build / serve |
| `npm test` | Vitest unit tests |
| `npx tsc --noEmit` | type-check |
| `npm run db:push` / `npm run db:seed` | sync schema / seed demo data |

## Project layout

```
prisma/schema.prisma        data model (users, tasks, planning, calls, notifications…)
src/app/(app)/              authenticated app routes (tasks, planning, calls, …)
src/app/api/                route handlers (cron, telegram webhook, notifications poll…)
src/server/queries/         read models (server-only)
src/server/actions/         Server Actions (writes)
src/server/                 notify, scheduler, lifecycle-engine, telegram, push
src/components/             UI, grouped by area
src/lib/                    i18n, dates/timezones, domain helpers
```

## Notes for reviewers

- Notification delivery: `src/server/notify.ts` (fan-out to bell + web-push + Telegram),
  `src/server/lifecycle-engine.ts` (scheduled reminders), `src/server/scheduler.ts` (cron run).
- Timezone logic lives in `src/lib/tz.ts` / `src/lib/week.ts`.
- Prisma client is generated to `src/generated/prisma` (regenerate with `npx prisma generate`).
