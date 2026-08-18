// Извлечь ID папки Google Drive из ссылки вида
// https://drive.google.com/drive/folders/<ID>?... или ...?id=<ID>
export function extractDriveFolderId(url: string): string | null {
  if (!url) return null;
  const byPath = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (byPath) return byPath[1];
  const byQuery = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (byQuery) return byQuery[1];
  return null;
}

// Встроенный просмотр папки (живой список файлов, обновляется автоматически).
// Требует, чтобы папка была расшарена «всім, у кого є посилання».
export function driveEmbedUrl(url: string): string | null {
  const id = extractDriveFolderId(url);
  return id ? `https://drive.google.com/embeddedfolderview?id=${id}#list` : null;
}
