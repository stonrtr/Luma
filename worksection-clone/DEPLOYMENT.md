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

## 8. Файли (на майбутнє)

Зараз вкладення зберігаються локально/через посилання. Для проду варто винести
в об'єктне сховище (S3/R2): додати драйвер завантаження + `S3_*` змінні. **Не реалізовано.**

## Швидкий старт (dev)

```bash
cp .env.example .env      # заповніть AUTH_SECRET
npm install
npx prisma db push
npm run dev               # порт 3100
npm test                  # юніт-тести
```
