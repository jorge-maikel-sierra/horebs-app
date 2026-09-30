import type { NextConfig } from "next";

// Orígenes externos a los que el sitio realmente necesita conectarse.
// Si se agrega una integración nueva (otro storage, otro dominio de
// imágenes, etc.) hay que sumarla acá o el navegador la va a bloquear.
const SUPABASE_ORIGIN = 'https://afvwtoseszjpudelxywn.supabase.co';
// Misma variable que ya usa el resto del sitio para hablarle a la API
// (apps/web/src/lib/admin-fetch.ts) — así, si el backend se migra de host
// (Railway, otra cuenta, etc.), alcanza con cambiar NEXT_PUBLIC_API_URL en
// Vercel, sin tocar código ni re-hardcodear esta URL de nuevo.
//
// A propósito SIN fallback: un valor por defecto silencioso fue la causa
// raíz de que el CSP apuntara meses a un dominio de Railway ya muerto
// (horebs-api-production.up.railway.app) sin que nadie lo notara hasta que
// el panel de admin quedó bloqueado por CORS. Mejor que el build truene acá
// a que un despliegue mal configurado llegue a producción en silencio.
if (!process.env.NEXT_PUBLIC_API_URL) {
  throw new Error(
    'Falta NEXT_PUBLIC_API_URL — definila en apps/web/.env.local (ver .env.local.example) o en las variables de entorno de Vercel antes de compilar.',
  );
}
const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL;

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
  // El noscript de GTM usa un <iframe> a este dominio. facebook.com se suma
  // porque fbevents.js, cuando su beacon normal a facebook.com/tr falla,
  // cae a un iframe/form-post de respaldo contra ese mismo dominio — los
  // hosts de Cloud Run/ECS que prueba antes cambian en cada redeploy de
  // Meta, así que esos sí se dejan bloquear a propósito (no hay forma
  // sostenible de listarlos).
  "frame-src https://www.googletagmanager.com https://www.facebook.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://www.facebook.com",
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
    // Habilita SVG en next/image solo para las portadas ilustradas del blog
    // (apps/web/public/blog/*.svg) — son archivos propios del repo, no
    // contenido subido por usuarios, así que el riesgo de SVG con script
    // embebido no aplica. El sandbox de la CSP de abajo igual lo bloquea.
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
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
