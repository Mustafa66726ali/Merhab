/** @type {import('next').NextConfig} */
// أصل الباك-إند الذي يمرّر إليه خادم الواجهة طلبات الـ API/الوسائط داخلياً.
// هكذا يتحدّث المتصفح (على أي جهاز) مع المنفذ 3000 فقط، فلا حاجة لفتح 8000.
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN || "http://127.0.0.1:8000";

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "127.0.0.1" },
      { protocol: "http", hostname: "localhost" },
    ],
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_ORIGIN}/api/:path*` },
      { source: "/media/:path*", destination: `${BACKEND_ORIGIN}/media/:path*` },
    ];
  },
  experimental: {
    optimizePackageImports: [
      "framer-motion",
      "react-icons",
      "react-bootstrap",
      "date-fns",
      "@tanstack/react-query",
    ],
  },
};

module.exports = nextConfig;
