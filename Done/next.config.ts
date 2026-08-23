import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // статический экспорт: бэкенда нет, всё живёт в localStorage браузера
  output: "export",
};

export default nextConfig;
