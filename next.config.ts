import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
});

const nextConfig: NextConfig = {
  turbopack: {},
  async rewrites() {
    return {
      afterFiles: [
        {
          source: "/api/memory/:path*",
          destination: "/api/memory/:path*",
        },
        {
          source: "/api/coordination/:path*",
          destination: "/api/coordination/:path*",
        },
        {
          source: "/api/costs/:path*",
          destination: "/api/costs/:path*",
        },
        {
          source: "/api/chat/:path*",
          destination: "/api/chat/:path*",
        },
      ],
    };
  },
};

export default withPWA(nextConfig);
