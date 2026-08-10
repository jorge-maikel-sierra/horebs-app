import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { NEGOCIO } from '@/lib/negocio';
import { breadcrumbJsonLd, jsonLdScript } from '@/lib/json-ld';

type Post = {
  titulo: string;
  slug: string;
  resumen: string;
  contenido: string;
  imagen_url: string | null;
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
    <article className="mx-auto max-w-3xl p-8">
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
        className="text-sm text-brand-orange underline transition-colors hover:text-brand-orange/80"
      >
        ← Volver al blog
      </Link>

      <h1 className="animate-fade-up mt-4 text-3xl font-bold text-zinc-900 sm:text-4xl dark:text-zinc-50">
        {post.titulo}
      </h1>

      {post.imagen_url && (
        <div className="animate-fade-up delay-1 relative mt-6 h-72 w-full overflow-hidden rounded-xl sm:h-96">
          <Image
            src={post.imagen_url}
            alt={post.titulo}
            fill
            sizes="(min-width: 768px) 720px, 100vw"
            className="object-cover"
            priority
          />
        </div>
      )}

      <div className="blog-content animate-fade-up delay-2 mt-8 text-zinc-700 dark:text-zinc-300">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {post.contenido}
        </ReactMarkdown>
      </div>
    </article>
  );
}
