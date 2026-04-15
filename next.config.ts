import type { NextConfig } from "next";

const backendOrigin = process.env.NEXT_PUBLIC_CHOKITO_API_ORIGIN?.trim();
const localOrigins = new Set([
  "http://127.0.0.1:3000",
  "http://localhost:3000",
  "https://127.0.0.1:3000",
  "https://localhost:3000",
]);

const shouldProxyApi = !!backendOrigin && !localOrigins.has(backendOrigin);

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "187.45.255.14",
    "pimpotasma.com.br",
    "www.pimpotasma.com.br",
  ],
  async rewrites() {
    if (!shouldProxyApi || !backendOrigin) {
      return [];
    }

    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
