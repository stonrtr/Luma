import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // индикатор дев-режима в правый нижний угол, чтобы не перекрывать кнопку «+»
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;
