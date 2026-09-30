import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { NEGOCIO } from '@/lib/negocio';
import { AUTOR } from '@/lib/autor';
import { formatFecha } from '@/lib/formato';
import { breadcrumbJsonLd, jsonLdScript } from '@/lib/json-ld';
import BlogLikeButton from '@/components/BlogLikeButton';
import BlogComentarios from '@/components/BlogComentarios';
import ScrollReveal from '@/components/ScrollReveal';

function IconFlechaIzquierda() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 12H5" />
      <path d="M11 18l-6-6 6-6" />
    </svg>
  );
}

type Post = {
  titulo: string;
  slug: string;
  resumen: string;
  contenido: string;
  imagen_url: string | null;
  etiqueta: string | null;
  publicado_en: string | null;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

async function getPost(slug: string): Promise<Post | null> {
  const res = await fetch(`${API_URL}/blog/posts/${slug}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    return { title: `Artículo no encontrado | ${NEGOCIO.nombre}` };
  }

  const title = `${post.titulo} | ${NEGOCIO.nombre}`;

  return {
    title,
    description: post.resumen,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title,
      description: post.resumen,
      images: post.imagen_url ? [post.imagen_url] : undefined,
      type: 'article',
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) notFound();

  const urlArticulo = `/blog/${slug}`;
  const urlArticuloAbsoluta = `https://${NEGOCIO.sitio}${urlArticulo}`;
  const logoUrl = `https://${NEGOCIO.sitio}/logo-horebs.png`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.titulo,
    description: post.resumen,
    image: post.imagen_url ?? undefined,
    datePublished: post.publicado_en ?? undefined,
    mainEntityOfPage: urlArticuloAbsoluta,
    author: { '@type': 'Organization', name: NEGOCIO.nombre },
    publisher: {
      '@type': 'Organization',
      name: NEGOCIO.nombre,
      logo: { '@type': 'ImageObject', url: logoUrl },
    },
  };

  const breadcrumbLd = breadcrumbJsonLd([
    { nombre: 'Inicio', ruta: '/' },
    { nombre: 'Blog', ruta: '/blog' },
    { nombre: post.titulo, ruta: urlArticulo },
  ]);

  return (
    <article className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbLd) }}
      />

      <Link
        href="/blog"
        className="btn-press inline-flex items-center gap-1.5 rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:border-brand-orange hover:text-brand-orange dark:border-zinc-700 dark:text-zinc-300"
      >
        <IconFlechaIzquierda />
        Volver al blog
      </Link>

      <h1 className="animate-fade-up mt-4 text-3xl font-bold text-zinc-900 sm:text-4xl dark:text-zinc-50">
        {post.titulo}
      </h1>
      <div className="animate-fade-up delay-1 mt-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- URL externa de Google, no vale la pena optimizarla con next/image. */}
          <img
            src={AUTOR.fotoUrl}
            alt={AUTOR.nombre}
            className="h-9 w-9 shrink-0 rounded-full object-cover"
          />
          <div>
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              {AUTOR.nombre}
            </p>
            {post.publicado_en && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {formatFecha(post.publicado_en)}
              </p>
            )}
          </div>
        </div>
        <BlogLikeButton slug={slug} />
      </div>

      {post.imagen_url && (
        <div className="animate-fade-up delay-1 relative mt-6 h-72 w-full overflow-hidden rounded-2xl shadow-lg shadow-zinc-900/5 dark:shadow-black/30">
          <Image
            src={post.imagen_url}
            alt={post.titulo}
            fill
            unoptimized={post.imagen_url.endsWith('.svg')}
            sizes="(min-width: 768px) 720px, 100vw"
            className="object-cover"
            priority
          />
          {post.etiqueta && (
            <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-zinc-700 shadow-sm backdrop-blur-sm dark:bg-zinc-900/80 dark:text-zinc-200">
              {post.etiqueta}
            </span>
          )}
        </div>
      )}

      <div className="blog-content animate-fade-up delay-2 mt-8 text-zinc-700 dark:text-zinc-300">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {post.contenido}
        </ReactMarkdown>
      </div>

      <ScrollReveal className="mt-12 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <BlogComentarios slug={slug} />
      </ScrollReveal>
    </article>
  );
}
