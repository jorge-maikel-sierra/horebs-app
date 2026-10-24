import { ImageResponse } from 'next/og';
import { NEGOCIO } from '@/lib/negocio';

export const alt = `Artículo del blog de ${NEGOCIO.nombre}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

async function getTitulo(slug: string): Promise<string> {
  try {
    const res = await fetch(`${API_URL}/blog/posts/${slug}`, { cache: 'no-store' });
    if (!res.ok) return NEGOCIO.nombre;
    const post: { titulo: string } = await res.json();
    return post.titulo;
  } catch {
    return NEGOCIO.nombre;
  }
}

/**
 * Imagen para compartir cada artículo (WhatsApp, Facebook). Las portadas
 * del blog son SVG y esas redes no las previsualizan, así que se genera un
 * PNG con el título sobre los colores de la marca.
 */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const titulo = await getTitulo(slug);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: '#1A3A52',
          color: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: '#FFD93D' }}>
          Blog de {NEGOCIO.nombre}
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: titulo.length > 60 ? 60 : 72,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}
        >
          {titulo}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 28 }}>
          <div style={{ display: 'flex', width: 56, height: 8, background: '#FF6B35' }} />
          {NEGOCIO.sitio}
        </div>
      </div>
    ),
    size,
  );
}
