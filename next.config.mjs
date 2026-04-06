/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

// GitHub Pages のリポジトリ名に合わせて変更してください
// 例: https://yourname.github.io/daratask/ の場合は "/daratask"
const REPO_NAME = "/daratask";

const nextConfig = {
  reactStrictMode: true,
  output: "export",          // 静的エクスポート（GitHub Pages用）
  basePath: isProd ? REPO_NAME : "",
  assetPrefix: isProd ? REPO_NAME + "/" : "",
  images: {
    unoptimized: true,       // next/image の最適化を無効化（静的エクスポート対応）
  },
};

export default nextConfig;
