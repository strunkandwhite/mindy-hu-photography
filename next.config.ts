import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: process.env.CLOUDFRONT_DOMAIN
      ? [
          {
            protocol: "https" as const,
            hostname: process.env.CLOUDFRONT_DOMAIN,
          },
        ]
      : [],
  },
};

export default nextConfig;
