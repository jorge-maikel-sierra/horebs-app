import type { NextConfig } from "next";

// Orígenes externos a los que el sitio realmente necesita conectarse.
// Si se agrega una integración nueva (otro storage, otro dominio de
// imágenes, etc.) hay que sumarla acá o el navegador la va a bloquear.
const SUPABASE_ORIGIN = 'https://afvwtoseszjpudelxywn.supabase.co';
const API_ORIGIN = 'https://horebs-api-production.up.railway.app';

// Google Tag Manager y el Pixel de Facebook cargan su propio script desde
// estos dominios. OJO: cualquier tag NUEVO que se agregue después desde la
// interfaz web de GTM (ej. un tag de otro proveedor) que llame a un host
// que no esté acá también va a quedar bloqueado por el CSP — hay que
// sumarlo a mano en este archivo, GTM no puede "saltarse" esta lista.
const SCRIPT_SRC_TAGS =
  'https://www.googletagmanager.com https://connect.facebook.net';
// Beacons de medición: GA4/GTM, conversiones de Google Ads (doubleclick) y
// el pixel de Facebook.
const CONNECT_SRC_TAGS =
  'https://www.googletagmanager.com https://www.google-analytics.com https://analytics.google.com https://td.doubleclick.net https://googleads.g.doubleclick.net https://www.facebook.com';

// React usa eval() en modo dev para reconstruir stack traces (HMR, overlay
// de errores) — nunca en producción. Sin esto el CSP rompe `next dev`.
// En producción Vercel sirve Speed Insights desde el propio dominio
// (ruta con hash único), pero en dev carga directo de va.vercel-scripts.com.
const SCRIPT_SRC =
  process.env.NODE_ENV === 'development'
    ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com ${SCRIPT_SRC_TAGS}`
    : `script-src 'self' 'unsafe-inline' ${SCRIPT_SRC_TAGS}`;

// En dev, apps/web/.env.local apunta NEXT_PUBLIC_API_URL a localhost:3000
// (el NestJS local) en vez de la API de Railway.
const CONNECT_SRC =
  process.env.NODE_ENV === 'development'
    ? `connect-src 'self' ${SUPABASE_ORIGIN} ${API_ORIGIN} http://localhost:3000 https://vitals.vercel-insights.com https://va.vercel-scripts.com ${CONNECT_SRC_TAGS}`
    : `connect-src 'self' ${SUPABASE_ORIGIN} ${API_ORIGIN} https://vitals.vercel-insights.com https://va.vercel-scripts.com ${CONNECT_SRC_TAGS}`;

const CSP = [
  "default-src 'self'",
  SCRIPT_SRC,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  CONNECT_SRC,
  // El noscript de GTM usa un <iframe> a este dominio.
  "frame-src https://www.googletagmanager.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

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
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
