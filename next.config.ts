import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },     // ✅ 构建阶段忽略 ESLint
  typescript: { ignoreBuildErrors: true },  // ✅ 构建阶段忽略 TS 错误（可选）
};

export default nextConfig;
