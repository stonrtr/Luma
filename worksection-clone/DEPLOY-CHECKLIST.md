# Чек-лист деплоя Workspace M на Cloudflare ($0/мес)

Стек: **Cloudflare Workers (OpenNext)** + **Neon Postgres** + **Cloudflare R2** (файлы) + **Resend** (почта).
Сборка под Cloudflare уже проверена и проходит (`opennextjs-cloudflare build` → зелёный).

Легенда: 🧑 — делаешь ты (аккаунты/кнопки), 🤖 — делаю я (код), ⏳ — один раз при деплое.

---

## 0. Аккаунты (бесплатные)
- 🧑 Cloudflare — https://dash.cloudflare.com/sign-up
- 🧑 Neon — https://neon.tech (Postgres)
- 🧑 Resend — https://resend.com (почта, опц.)
- 🧑 Домен (опц., но желателен): свой или бесплатный `*.workers.dev`

---

## 1. 🧑 Neon — база данных
1. Console → **Create project** (регион ближе к команде, напр. EU).
2. После создания → **Connection string** → выбери **Pooled connection** (важно для serverless).
3. Скопируй строку вида
   `postgresql://user:pass@ep-xxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require`
   → это `DATABASE_URL`.

## 2. 🧑 Cloudflare R2 — файлы
1. Dashboard → **R2** → **Create bucket** (напр. `workspace-m-files`). *(R2 требует привязать карту, но в пределах 10 ГБ — бесплатно.)*
2. **R2 → Manage API Tokens → Create API Token** (права: Object Read & Write) → сохрани **Access Key ID** и **Secret Access Key**.
3. Возьми **Account ID** (правая колонка в R2/Overview) → эндпоинт:
   `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
4. Приватный бакет оставь как есть (файлы будут отдаваться через `/api/files/<key>` только залогиненным). Публичный URL не нужен.

## 3. 🧑 Resend — почта (опц., чтобы пароли не светились на экране)
1. Resend → **API Keys → Create** → сохрани ключ (`RESEND_API_KEY`).
2. **Domains → Add domain** → добавь DNS-записи (если нет домена — можно позже, приглашения будут показывать пароль в UI).
3. `MAIL_FROM` вида `Workspace M <no-reply@твойдомен>`.

## 4. 🧑 Сгенерируй секреты (локально)
```bash
openssl rand -base64 32   # → AUTH_SECRET
openssl rand -base64 32   # → CRON_SECRET
```
Придумай `ADMIN_EMAIL` / `ADMIN_PASSWORD` (первый вход руководителя).

---

## 5. 🤖⏳ Код под Postgres (моя часть — скажи «делай миграцию»)
1. В `prisma/schema.prisma`: `provider = "sqlite"` → `provider = "postgresql"`, `url = env("DATABASE_URL")`.
2. Создать первую миграцию против Neon:
   ```bash
   DATABASE_URL="<neon-pooled-url>" npx prisma migrate dev --name init
   ```
3. Раскомментировать cron в `wrangler.jsonc` и добавить обработчик `scheduled`,
   который дёргает `/api/cron/run` с `Authorization: Bearer $CRON_SECRET`
   *(либо внешний пингер — см. шаг 9, вариант Б)*.

> После перехода на Postgres локальная разработка тоже идёт на Postgres
> (можно завести бесплатную dev-ветку в Neon). SQLite остаётся только в истории.

---

## 6. 🧑⏳ Первый деплой
```bash
# войти в Cloudflare
npx wrangler login

# залить секреты (по одному; значение спросит интерактивно)
npx wrangler secret put DATABASE_URL
npx wrangler secret put AUTH_SECRET
npx wrangler secret put CRON_SECRET
npx wrangler secret put APP_URL                 # https://<твой-домен или *.workers.dev>
npx wrangler secret put S3_ENDPOINT
npx wrangler secret put S3_BUCKET
npx wrangler secret put S3_ACCESS_KEY_ID
npx wrangler secret put S3_SECRET_ACCESS_KEY
npx wrangler secret put S3_REGION               # auto
# опционально: RESEND_API_KEY, MAIL_FROM, GEMINI_API_KEY, TELEGRAM_* , VAPID_*

# собрать и задеплоить
npx opennextjs-cloudflare build
npx opennextjs-cloudflare deploy
```
После деплоя wrangler покажет URL воркера (`https://workspace-m.<...>.workers.dev`).

## 7. 🧑⏳ Инициализация БД
```bash
# применить схему к Neon
DATABASE_URL="<neon-pooled-url>" npx prisma migrate deploy

# создать первого админа
DATABASE_URL="<neon-pooled-url>" ADMIN_EMAIL="..." ADMIN_PASSWORD="..." ADMIN_NAME="..." \
  npm run ensure:admin
```
Зайди под этим логином → в «Настройки/Админ» заводишь остальных сотрудников.

## 8. 🧑 Домен и прод-URL
1. Cloudflare → Workers → твой воркер → **Settings → Domains & Routes → Add Custom Domain**
   (или используй выданный `*.workers.dev`).
2. Обнови секрет `APP_URL` на финальный адрес и передеплой (`deploy`).
3. Если используешь интеграции — впиши этот URL:
   - Google Calendar: redirect `https://<APP_URL>/api/google/callback`
   - Telegram webhook: `setWebhook?url=https://<APP_URL>/api/telegram/webhook`

## 9. Cron (напоминания, просрочки, регулярные задачи)
- **Вариант А (🤖):** Cloudflare **Cron Trigger** в `wrangler.jsonc` + обработчик `scheduled` (я добавлю).
- **Вариант Б (🧑, без кода):** внешний пингер (cron-job.org, бесплатно):
  URL `https://<APP_URL>/api/cron/run`, заголовок `Authorization: Bearer <CRON_SECRET>`, раз в 15 мин.

---

## 10. ✅ Проверка после деплоя
- [ ] Открывается публичный URL, логин работает.
- [ ] Загрузка файла в задаче → файл сохраняется и открывается (значит R2 + `/api/files` ок).
- [ ] Через ~15 мин видно, что cron отработал (или дёрни `/api/cron/run` вручную с заголовком).
- [ ] Приглашение сотрудника приходит на почту (если настроен Resend).

---

### Что нужно от тебя, чтобы я продолжил код (шаг 5)
Просто напиши «делай миграцию» — и я переключу схему на Postgres, создам первую миграцию
и допишу cron-обработчик. Значения секретов мне не нужны и я их не прошу — их вводишь только ты
(шаг 6, `wrangler secret`).
