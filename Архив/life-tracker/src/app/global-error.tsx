"use client";

// Резервная граница ошибок для корневого layout (без Tailwind — стили инлайном)
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="uk">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f8fafc", color: "#0f172a" }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>Щось пішло не так</h2>
          <p style={{ marginTop: "6px", fontSize: "14px", color: "#64748b" }}>Сталася критична помилка. Спробуйте перезавантажити.</p>
          <button
            onClick={() => retry()}
            style={{ marginTop: "16px", padding: "8px 16px", borderRadius: "8px", border: "none", background: "#4f46e5", color: "#fff", fontSize: "14px", cursor: "pointer" }}
          >
            Спробувати ще раз
          </button>
        </div>
      </body>
    </html>
  );
}
