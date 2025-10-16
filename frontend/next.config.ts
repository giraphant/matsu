import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use standalone output for Docker deployment
  output: 'standalone',
  images: {
    unoptimized: true
  },
  // Rewrite API requests to backend service
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://backend:9988';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/webhook/:path*',
        destination: `${backendUrl}/webhook/:path*`,
      },
      {
        source: '/health',
        destination: `${backendUrl}/health`,
      },
    ];
  },
};

export default nextConfig;