import "server-only";
import { promises as fs } from "fs";
import path from "path";

// Единый слой хранилища вложений (host-agnostic).
// Если заданы S3_* переменные — грузим в объектное хранилище (Cloudflare R2 / S3 / Supabase / Backblaze).
// Иначе (локальная разработка) — пишем на диск в public/uploads.
//
// Ключ объекта — это относительный путь без ведущего слэша, напр. "tasks/<id>/<uuid>-name.pdf".
// В БД сохраняется публичный URL (см. urlForKey); удаление умеет вычислить ключ из URL (keyFromUrl).

// Санация env-значений: вырезаем ВСЕ пробелы и непечатаемые символы (не только по краям —
// при вставке в дашборд перенос строки может попасть и в середину значения). Невалидный символ
// в ключе доступа ломает заголовок Authorization в AWS SDK (ERR_INVALID_CHAR).
// Для эндпоинта/бакета/ключей легитимных пробелов не существует, поэтому это безопасно.
const clean = (v: string | undefined) => (v ?? "").replace(/[^\x21-\x7e]/g, "");
const S3_ENDPOINT = clean(process.env.S3_ENDPOINT);
const S3_BUCKET = clean(process.env.S3_BUCKET);
const S3_ACCESS_KEY_ID = clean(process.env.S3_ACCESS_KEY_ID);
const S3_SECRET_ACCESS_KEY = clean(process.env.S3_SECRET_ACCESS_KEY);
const S3_REGION = clean(process.env.S3_REGION) || "auto"; // R2 → "auto"
// Публичная база для отдачи файлов: r2.dev / кастомный домен / CDN. Без слэша в конце.
// Если пусто — файлы отдаём через наш авторизованный прокси /api/files/<key>.
const S3_PUBLIC_URL = (process.env.S3_PUBLIC_URL ?? "").replace(/\/+$/, "");

export function isCloudStorage(): boolean {
  return Boolean(S3_ENDPOINT && S3_BUCKET && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY);
}

// Ленивая инициализация клиента — aws-sdk грузится только когда хранилище настроено.
let _client: import("@aws-sdk/client-s3").S3Client | null = null;
async function client() {
  if (_client) return _client;
  const { S3Client } = await import("@aws-sdk/client-s3");
  _client = new S3Client({
    region: S3_REGION,
    endpoint: S3_ENDPOINT,
    forcePathStyle: true, // R2 и большинство S3-совместимых любят path-style
    credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
  });
  return _client;
}

// Публичный URL для сохранения в БД.
function urlForKey(key: string): string {
  if (isCloudStorage()) {
    return S3_PUBLIC_URL ? `${S3_PUBLIC_URL}/${key}` : `/api/files/${key}`;
  }
  return `/uploads/${key}`;
}

// Обратное преобразование URL → ключ объекта (для удаления/отдачи).
export function keyFromUrl(url: string): string | null {
  if (url.startsWith("/uploads/")) return url.slice("/uploads/".length);
  if (url.startsWith("/api/files/")) return url.slice("/api/files/".length);
  if (S3_PUBLIC_URL && url.startsWith(`${S3_PUBLIC_URL}/`)) return url.slice(S3_PUBLIC_URL.length + 1);
  return null;
}

// Загрузить объект. Возвращает публичный URL для БД.
export async function putObject(key: string, body: Buffer, contentType: string): Promise<string> {
  if (isCloudStorage()) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const c = await client();
    await c.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: body, ContentType: contentType }));
    return urlForKey(key);
  }
  const abs = path.join(process.cwd(), "public", "uploads", key);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, body);
  return urlForKey(key);
}

// Удалить объект по публичному URL (молча игнорируем отсутствие).
export async function deleteByUrl(url: string): Promise<void> {
  const key = keyFromUrl(url);
  if (!key) return; // внешняя ссылка (kind=LINK) — ничего не храним у себя
  if (isCloudStorage()) {
    try {
      const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      const c = await client();
      await c.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    } catch {
      // уже удалён — не критично
    }
    return;
  }
  try {
    await fs.unlink(path.join(process.cwd(), "public", "uploads", key));
  } catch {
    // уже удалён — не критично
  }
}

// Прочитать объект (для авторизованного прокси /api/files, когда бакет приватный).
export async function getObjectStream(
  key: string,
): Promise<{ body: ReadableStream | Buffer; contentType: string; contentLength?: number } | null> {
  if (isCloudStorage()) {
    try {
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      const c = await client();
      const r = await c.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }));
      return {
        body: r.Body as unknown as ReadableStream,
        contentType: r.ContentType || "application/octet-stream",
        contentLength: r.ContentLength,
      };
    } catch {
      return null;
    }
  }
  try {
    const abs = path.join(process.cwd(), "public", "uploads", key);
    const buf = await fs.readFile(abs);
    return { body: buf, contentType: "application/octet-stream", contentLength: buf.length };
  } catch {
    return null;
  }
}
