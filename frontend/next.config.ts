import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use standalone output for Docker deployment
  output: 'standalone',
  images: {
    unoptimized: true
  },
};

export default nextConfig;