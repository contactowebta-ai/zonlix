import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? {
      exclude: ["error"],
    } : false,
  },
  turbopack: {
    // Establece la raíz correcta del proyecto para Turbopack
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
