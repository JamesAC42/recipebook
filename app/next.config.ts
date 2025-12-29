import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/recipebook',
  async rewrites() {
    // Only apply rewrites in development. In production, Nginx handles the /api proxying.
    if (process.env.NODE_ENV === 'production') {
      return [];
    }
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:5000/api/:path*',
      },
    ];
  },
};

export default nextConfig;
