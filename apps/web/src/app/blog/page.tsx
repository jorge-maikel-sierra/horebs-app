import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { NEGOCIO } from '@/lib/negocio';
import { AUTOR } from '@/lib/autor';
import { formatFecha } from '@/lib/formato';
import EstadoVacio from '@/components/EstadoVacio';

type PostResumen = {
  titulo: string;
  slug: string;
  resumen: string;
  imagen_url: string | null;
  etiqueta: string | null;
  publicado_en: string | null;
};

function IconFlechaDerecha() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

async function getPosts(): Promise<PostResumen[]> {
  const res = await fetch(`${API_URL}/blog/posts`, { cache: 'no-store' });
  if (!res.ok) return [];
  return res.json();
}

export const metadata: Metadata = {
  title: `Blog | ${NEGOCIO.nombre}`,
  description: `Novedades, recomendaciones y todo sobre pizza y comida en Riohacha, por ${NEGOCIO.nombre}.`,
  alternates: { canonical: '/blog' },
};

export default async function BlogPage() {
  const posts = await getPosts();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <h1 className="animate-fade-up text-3xl font-bold text-zinc-900 sm:text-4xl dark:text-zinc-50">
        Blog
      </h1>
      <p className="animate-fade-up delay-1 mt-2 text-zinc-600 dark:text-zinc-400">
        Recomendaciones, novedades y todo sobre pizza en Riohacha.
      </p>

      {posts.length === 0 ? (
        <EstadoVacio>Todavía no hay artículos publicados.</EstadoVacio>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {posts.map((post, i) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="card-interactive card-gradient animate-fade-up group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800"
              style={{ animationDelay: `${Math.min(i, 4) * 0.08}s` }}
            >
              {post.imagen_url && (
                <div className="relative h-44 w-full shrink-0 overflow-hidden">
                  <Image
                    src={post.imagen_url}
                    alt={post.titulo}
                    fill
                    unoptimized={post.imagen_url.endsWith('.svg')}
                    sizes="(min-width: 640px) 380px, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  {post.etiqueta && (
                    <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-zinc-700 shadow-sm backdrop-blur-sm dark:bg-zinc-900/80 dark:text-zinc-200">
                      {post.etiqueta}
                    </span>
                  )}
                </div>
              )}
              <div className="flex flex-1 flex-col p-5">
                <h2 className="font-semibold text-zinc-900 transition-colors group-hover:text-brand-orange dark:text-zinc-50">
                  {post.titulo}
                </h2>
                <p className="mt-1.5 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {post.resumen}
                </p>
                <div className="mt-auto flex items-center justify-between gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800/60">
                  <div className="flex min-w-0 items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- URL externa de Google, no vale la pena optimizarla con next/image. */}
                    <img
                      src={AUTOR.fotoUrl}
                      alt={AUTOR.nombre}
                      className="h-7 w-7 shrink-0 rounded-full object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        {AUTOR.nombre}
                      </p>
                      {post.publicado_en && (
                        <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                          {formatFecha(post.publicado_en)}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="btn-press inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors group-hover:border-brand-orange group-hover:text-brand-orange dark:border-zinc-700 dark:text-zinc-300">
                    Leer más
                    <IconFlechaDerecha />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
