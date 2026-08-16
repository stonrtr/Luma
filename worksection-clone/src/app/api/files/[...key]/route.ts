import { requireUser } from "@/server/dal";
import { getObjectStream } from "@/server/storage";

export const dynamic = "force-dynamic";

// Авторизованная отдача приватных вложений из объектного хранилища.
// Используется, когда S3_PUBLIC_URL не задан (бакет приватный). Требует входа.
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  await requireUser(); // только для залогиненных
  const { key } = await params;
  const objectKey = key.map(decodeURIComponent).join("/");

  const obj = await getObjectStream(objectKey);
  if (!obj) return new Response("Not found", { status: 404 });

  const headers = new Headers({
    "Content-Type": obj.contentType,
    "Cache-Control": "private, max-age=3600",
  });
  if (obj.contentLength != null) headers.set("Content-Length", String(obj.contentLength));

  const body = obj.body instanceof Buffer ? new Uint8Array(obj.body) : obj.body;
  return new Response(body as BodyInit, { headers });
}
