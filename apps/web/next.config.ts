import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pizzeriahorebs.shop',
        pathname: '/wp-content/uploads/**',
      },
      {
        protocol: 'https',
        hostname: 'afvwtoseszjpudelxywn.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
};

export default nextConfig;
