// hackmap-next/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  // Suppress "Critical dependency" warnings from next-auth
  webpack: (config) => {
    config.externals = [...(config.externals || [])];
    return config;
  },
};

export default nextConfig;
