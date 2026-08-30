# Мгновенный захват идей из Telegram (серверный вебхук)

Бот отвечает за ~1 секунду **даже при закрытом приложении**. Схема:

```
Telegram → /api/telegram (Vercel serverless) → мгновенный ответ + запись в Upstash
Приложение Done (когда открыто) → /api/ideas → забирает накопленные идеи во «Входящие»
```

## Настройка (один раз, ~10 минут)

### 1. Бот
Создайте бота через **@BotFather** (`/newbot`), скопируйте токен.

### 2. Upstash Redis (бесплатно)
1. Зарегистрируйтесь на https://upstash.com (free-тир).
2. Create Database → Redis → любой регион → Create.
3. На странице базы, в блоке **REST API**, скопируйте:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

### 3. Переменные окружения в Vercel
Vercel → проект → **Settings → Environment Variables** → добавьте (Production + Preview):

| Имя | Значение |
|---|---|
| `UPSTASH_REDIS_REST_URL` | из Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | из Upstash |
| `TG_BOT_TOKEN` | токен бота из BotFather |
| `SYNC_SECRET` | придумайте строку, например `done-9f3k2xQ` |

Затем **Redeploy** проекта (Deployments → последний → Redeploy), чтобы переменные применились.

### 4. Регистрация вебхука
Откройте в браузере (подставьте свои значения), один раз:

```
https://api.telegram.org/bot<TG_BOT_TOKEN>/setWebhook?url=https://<ваш-домен>.vercel.app/api/telegram&secret_token=<SYNC_SECRET>
```

Ответ `{"ok":true,...}` — вебхук установлен. Проверка: `.../getWebhookInfo`.

### 5. Приложение
Настройки → «Идеи из Telegram»:
- включите **«Отдельный бот…»**;
- включите **«Мгновенный захват через сервер»**;
- в «Ключ синхронизации» вставьте тот же `SYNC_SECRET`;
- «База API» оставьте пустой, если приложение открыто с того же домена Vercel.

Готово. Пишите боту — ответ приходит сразу, идея появляется во «Входящих» при открытии приложения.

> Клиентский режим (тумблер «Мгновенный захват» выключен) работает без сервера, но ловит
> идеи только пока открыта вкладка приложения.

---

# Google Календарь (серверная двусторонняя синхронизация)

Задачи с датой создаются событиями в отдельном календаре **«Done»**, а его события
показываются в ленте приложения. Токены хранит сервер (Upstash), как в Telegram-захвате.
Использует тот же `SYNC_SECRET`.

## Настройка (один раз)

### 1. OAuth-клиент в Google Cloud
1. https://console.cloud.google.com/apis/credentials → **Create Credentials → OAuth client ID**.
2. Application type: **Web application**.
3. **Authorized redirect URIs** → добавь: `https://<домен>/api/gcal/callback`
   (например `https://peak-ashen-six.vercel.app/api/gcal/callback`).
4. Create → скопируй **Client ID** и **Client secret**.
5. Экран согласия (OAuth consent screen): если приложение в режиме Testing — добавь свой
   Google-аккаунт в **Test users**. Scope: Google Calendar (`.../auth/calendar`).

### 2. Переменные в Vercel
Добавь к уже существующим:

| Имя | Значение |
|---|---|
| `GOOGLE_CLIENT_ID` | Client ID из шага 1 |
| `GOOGLE_CLIENT_SECRET` | Client secret из шага 1 |

Затем **Redeploy**.

### 3. Подключение в приложении
Настройки → **Google Календарь** → **Подключить Google** → подтверди доступ в открывшемся
окне → вернись и нажми **Проверить**. Должно показать «Подключено».

Готово: события пишутся в календарь «Done» и видны и в приложении, и среди всех твоих
календарей в Google.
