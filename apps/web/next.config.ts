import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pizzeriahorebs.shop',
        pathname: '/wp-content/uploads/**',
      },
    ],
  },
};

export default nextConfig;
