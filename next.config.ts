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
          source: "/api/:path*",
          destination: "http://127.0.0.1:3001/:path*",
        },
      ],
    };
  },
};

export default withPWA(nextConfig);
