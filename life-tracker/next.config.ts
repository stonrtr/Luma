import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // индикатор дев-режима в правый нижний угол, чтобы не перекрывать кнопку «+»
  devIndicators: {
    position: "bottom-right",
  },
  experimental: {
    // загрузка файлов идёт через Server Actions; поднимаем лимит тела (дефолт 1 МБ)
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
