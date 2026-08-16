# Деплой team M у продакшн

Застосунок написаний так, що всі зовнішні інтеграції **вимкнені за замовчуванням**
і вмикаються додаванням відповідних змінних оточення (див. `.env.example`).
Нижче — що потрібно налаштувати для проду. Кроки, які потребують ваших
секретів/сервісів, позначені 🔑.

## 1. База даних: SQLite → Postgres 🔑

Dev працює на SQLite. Для проду:

1. Підніміть Postgres (Neon / Supabase / RDS / власний) і візьміть `DATABASE_URL`.
2. У `prisma/schema.prisma` змініть провайдер:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. Перейдіть на версійні міграції замість `db push`:
   ```bash
   npx prisma migrate dev --name init      # локально створить першу міграцію
   npx prisma migrate deploy                # на сервері застосує міграції
   ```
   (Зараз схема синхронізується через `prisma db push` — для проду використовуйте `migrate`.)

## 2. Аутентифікація 🔑

- `AUTH_SECRET` — `openssl rand -base64 32`.
- `APP_URL` — публічний URL.
- Демо-логін лишається для сідера (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).
- **Не реалізовано** (за потреби — окремі задачі): скидання пароля, підтвердження email,
  OAuth-вхід, 2FA, rate-limit на логін.

## 3. Планувальник (cron) 🔑

Нагадування (прострочка, KPI) та регулярні задачі виконує `/api/cron/run`.
Задайте `CRON_SECRET` і викликайте ендпоінт за розкладом:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://APP/api/cron/run
```

- **Vercel Cron:** додайте у `vercel.json` `{"crons":[{"path":"/api/cron/run","schedule":"*/15 * * * *"}]}`
  і передавайте секрет (Vercel шле запит без заголовка — за потреби перевіряйте `?key=`).
- **Render / інше:** окремий Cron Job, що робить `curl` вище.

## 4. Пошта (опційно) 🔑

Для листів-запрошень задайте `RESEND_API_KEY` **або** SMTP-змінні + `MAIL_FROM`.
Без цього акаунт створюється, а пароль показується в UI.

## 5. Google Calendar (опційно) 🔑

Див. картку в «Налаштування». Потрібні `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`
і redirect URI `$APP_URL/api/google/callback` у Google Cloud Console.

## 6. Web-push (опційно) 🔑

`npx web-push generate-vapid-keys` → `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`. UI-тумблер зараз прихований — вмикається окремо.

## 7. ШІ-витяг задач (опційно) 🔑

`ANTHROPIC_API_KEY` (+ опц. `ANTHROPIC_MODEL`). Без ключа — евристичний розбір.

## 8. Telegram-бот (опційно) 🔑

Дозволяє отримувати сповіщення в Telegram і керувати задачами з телефона.

1. Створіть бота у **@BotFather** → отримайте `TELEGRAM_BOT_TOKEN` і username → `TELEGRAM_BOT_USERNAME`.
2. Придумайте `TELEGRAM_WEBHOOK_SECRET` (будь-який рядок).
3. Зареєструйте вебхук (потрібен публічний HTTPS URL; для локалки — тунель типу ngrok):
   ```bash
   curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=$APP_URL/api/telegram/webhook&secret_token=$TELEGRAM_WEBHOOK_SECRET"
   ```
4. У застосунку: Налаштування → Telegram → «Підключити» (відкриє бота з кодом прив'язки).

Команди бота: `/today`, `/inbox`, `/tasks`, `/new назва`, `/help`.
Сповіщення застосунку дублюються в Telegram автоматично після прив'язки.

## 9. Файли: S3/R2 сховище ✅ (реалізовано)

Єдиний шар `src/server/storage.ts` (host-agnostic). Якщо задані `S3_*` змінні —
вкладення (задачі, файли команди, аватари) летять в об'єктне сховище; інакше — на
локальний диск `public/uploads` (dev). Драйвер S3-сумісний: працює з Cloudflare R2,
AWS S3, Supabase Storage, Backblaze B2.

Cloudflare R2:
1. R2 → Create bucket (напр. `team-m-files`).
2. R2 → Manage API Tokens → створіть Access Key ID / Secret.
3. У `.env`:
   ```bash
   S3_ENDPOINT="https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
   S3_BUCKET="team-m-files"
   S3_ACCESS_KEY_ID="..."
   S3_SECRET_ACCESS_KEY="..."
   S3_REGION="auto"
   # Приватний бакет (рекомендовано): лишіть порожнім — файли віддаються через
   # авторизований проксі /api/files/<key> (тільки для залогінених).
   # Публічний бакет/домен: вкажіть базу, напр. https://files.example.com
   S3_PUBLIC_URL=""
   ```

## 10. Хостинг на Cloudflare (обраний шлях) 🔑

Next.js крутиться на Cloudflare Workers через адаптер **OpenNext**.

1. `npm i -D @opennextjs/cloudflare wrangler`
2. Додати `wrangler.toml` + `open-next.config.ts` (див. окрему задачу зі скафолдингом).
3. Postgres — **Neon** (free): `DATABASE_URL` з connection pooling. Наш cron `/api/cron/run`
   тримає БД теплою → не засинає.
4. Cron — **Cloudflare Cron Triggers** у `wrangler.toml` (кожні 15 хв дьоргати `/api/cron/run`
   з заголовком `Authorization: Bearer $CRON_SECRET`).
5. Секрети — `wrangler secret put AUTH_SECRET` тощо (не через `.env` у проді).
6. Домен — Workers Custom Domain; він же йде в `APP_URL`, redirect URI Google, вебхук Telegram.

> ⚠️ Next 16 дуже свіжий; якщо OpenNext-збірка впреться — запасні варіанти: **Netlify** (SSR
> через функції, теж free для комерції) або **Fly.io** (є постійний volume — тоді S3 не обов'язковий).

## Швидкий старт (dev)

```bash
cp .env.example .env      # заповніть AUTH_SECRET
npm install
npx prisma db push
npm run dev               # порт 3100
npm test                  # юніт-тести
```
