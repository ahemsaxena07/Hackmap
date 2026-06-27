// hackmap-next/next.config.ts

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Google OAuth avatars
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      // GitHub OAuth avatars
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  experimental: {
    // Enable server actions (used by NextAuth v5)
    serverActions: { allowedOrigins: ["localhost:3000"] },
  },
};

export default nextConfig;
