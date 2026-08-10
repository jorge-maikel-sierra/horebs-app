import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { NEGOCIO } from '@/lib/negocio';

type PostResumen = {
  titulo: string;
  slug: string;
  resumen: string;
  imagen_url: string | null;
  publicado_en: string | null;
};

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
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="animate-fade-up text-3xl font-bold text-zinc-900 sm:text-4xl dark:text-zinc-50">
        Blog
      </h1>
      <p className="animate-fade-up delay-1 mt-2 text-zinc-600 dark:text-zinc-400">
        Recomendaciones, novedades y todo sobre pizza en Riohacha.
      </p>

      {posts.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500 dark:text-zinc-400">
          Todavía no hay artículos publicados.
        </p>
      ) : (
        <div className="mt-8 space-y-6">
          {posts.map((post, i) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="card-interactive animate-fade-up group flex gap-4 rounded-lg border border-zinc-200 p-4 hover:border-brand-orange dark:border-zinc-800"
              style={{ animationDelay: `${Math.min(i, 4) * 0.08}s` }}
            >
              {post.imagen_url && (
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md">
                  <Image
                    src={post.imagen_url}
                    alt={post.titulo}
                    fill
                    sizes="96px"
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </div>
              )}
              <div>
                <h2 className="font-semibold text-zinc-900 transition-colors group-hover:text-brand-orange dark:text-zinc-50">
                  {post.titulo}
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {post.resumen}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
