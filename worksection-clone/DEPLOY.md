# Деплой на сервер (Railway / Render)

Приложение — Next.js 16 + Prisma (driver adapters). В проде БД — **PostgreSQL**,
файлы — на **постоянном диске** (volume), крон дёргает `/api/cron/run`.

Локальная разработка остаётся на SQLite без изменений: адаптер выбирается по
`DATABASE_URL` (`postgres://…` → Postgres, иначе SQLite). В контейнере провайдер
схемы переключается на `postgresql` при сборке (`Dockerfile`).

---

## Переменные окружения

Обязательные:

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | строка подключения Postgres (Railway/Render дают автоматически) |
| `AUTH_SECRET` | секрет сессий (любая длинная случайная строка) |
| `APP_URL` | публичный URL, напр. `https://work.example.com` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | владелец, создаётся при первом старте |
| `CRON_SECRET` | защита `/api/cron/run` |

Опциональные (включают соответствующие фичи): `GEMINI_API_KEY`/`ANTHROPIC_API_KEY`
(разбор саммари), `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (Google Calendar),
`VAPID_*` + `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (web-push), `TELEGRAM_BOT_TOKEN`/
`TELEGRAM_BOT_USERNAME`/`TELEGRAM_WEBHOOK_SECRET` (бот), `RESEND_API_KEY`+`MAIL_FROM`
или `SMTP_*` (почта).

Сгенерировать VAPID-ключи для пушей:

```bash
npx web-push generate-vapid-keys
```

`VAPID_PUBLIC_KEY` и `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = один и тот же публичный ключ.

---

## Вариант A — Railway (рекомендую)

1. **New Project → Deploy from GitHub repo** (репозиторий с этим кодом). Railway
   увидит `Dockerfile` и соберёт по нему.
2. **Add → Database → PostgreSQL.** Railway создаст переменную `DATABASE_URL` —
   привяжите её к сервису приложения (Variables → Reference).
3. **Variables** сервиса: задайте `AUTH_SECRET`, `APP_URL`, `ADMIN_EMAIL`,
   `ADMIN_PASSWORD`, `CRON_SECRET` и нужные опциональные.
4. **Volume** (для загруженных файлов): сервис → Volumes → Mount path
   `/app/public/uploads`.
5. Первый деплой применит схему к Postgres (`prisma db push`) и создаст админа
   автоматически (см. `docker-entrypoint.sh`).
6. **Домен**: Settings → Networking → Generate Domain. Впишите его в `APP_URL`
   (и передеплойте).
7. **Крон.** Проще всего — внешний планировщик (напр. cron-job.org) раз в 15 минут:
   ```
   GET https://<APP_URL>/api/cron/run   заголовок: Authorization: Bearer <CRON_SECRET>
   ```
   Либо отдельный Railway-cron-сервис с той же командой curl.

---

## Вариант B — Render

1. **New → Blueprint**, укажите репозиторий — Render прочитает `render.yaml`
   (веб-сервис + Postgres + диск `/app/public/uploads` + cron уже описаны).
2. Заполните секреты с `sync:false` в UI (`APP_URL`, `ADMIN_*`, ключи интеграций).
3. Deploy. Схема и админ создадутся при старте. Cron-джоба уже настроена на
   `*/15 * * * *`.

---

## После деплоя (интеграции)

- **Google OAuth**: в Google Cloud Console добавьте redirect URI
  `https://<APP_URL>/api/google/callback`.
- **Telegram webhook** (один раз, после того как известен `APP_URL`):
  ```bash
  curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<APP_URL>/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
  ```
- **Проверка крона**:
  ```bash
  curl -H "Authorization: Bearer <CRON_SECRET>" https://<APP_URL>/api/cron/run
  # → {"ok":true,...}
  ```

Плановые уведомления (план дня в 10:00, просрочки, регулярные задачи) идут только
в будни по Киеву (`Europe/Kyiv`).

---

## Локальный прод-паритет (по желанию, нужен Docker)

```bash
docker compose up --build
# http://localhost:3100 — вход admin@worksection.local / Password1!
```

Обычная локальная разработка (`npm run dev`) продолжает работать на SQLite
без Docker.
