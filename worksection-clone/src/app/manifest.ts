import type { MetadataRoute } from "next";

// PWA-манифест: даёт «Установить на главный экран» на телефоне —
// приложение открывается в своём окне, без адресной строки браузера.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Workspace M",
    short_name: "Workspace M",
    description: "Управление проектами, задачами и временем",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f4ee",
    theme_color: "#f4f4ee",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
