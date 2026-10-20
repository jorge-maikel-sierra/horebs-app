import type { CSSProperties } from 'react';
import { NEGOCIO } from '@/lib/negocio';
import { getGoogleReviews, type GoogleReview } from '@/lib/google-reviews';

// Solo reseñas de 4 y 5 estrellas: es una sección de testimonios. El
// promedio real y el enlace a todas las reseñas siguen a la vista.
const RATING_MINIMO = 4;

const RECOMENDACIONES = [
  { nombre: 'Sluurpy', href: 'https://co.sluurpy.com/riohacha/restaurante/7921075/pizzeria-horebs' },
  { nombre: 'Restaurant Guru', href: 'https://restaurantguru.com/Horebs-Riohacha' },
] as const;

const ESTRELLA = 'm12 2 2.9 6.6 7.1.6-5.4 4.8 1.7 7-6.3-3.8L5.7 21l1.7-7-5.4-4.8 7.1-.6Z';

function escalon(d: number) {
  return { '--d': d } as CSSProperties;
}

/** Cinco estrellas con relleno parcial (4,7 llena el 94%). Solo visual. */
function Estrellas({ valor }: { valor: number }) {
  const fila = (relleno: boolean) =>
    Array.from({ length: 5 }).map((_, i) => (
      <svg
        key={i}
        viewBox="0 0 24 24"
        className="h-6 w-6 shrink-0"
        fill={relleno ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d={ESTRELLA} />
      </svg>
    ));
  return (
    <span aria-hidden="true" className="relative inline-flex gap-1 text-accent-ink">
      <span className="inline-flex gap-1 opacity-35">{fila(false)}</span>
      <span
        className="absolute inset-y-0 left-0 inline-flex gap-1 overflow-hidden"
        style={{ width: `${Math.min(100, (valor / 5) * 100)}%` }}
      >
        {fila(true)}
      </span>
    </span>
  );
}

/** La primera oración abre la carta en grande, si es corta; el resto sigue. */
function partir(texto: string): [string | null, string[]] {
  const limpio = texto.trim();
  const m = limpio.match(/^(.+?[.!?])\s+([\s\S]+)$/);
  const [primera, resto] = m ? [m[1], m[2]] : [limpio, ''];
  if (primera.length > 160) return [null, limpio.split(/\n+/)];
  return [primera, resto ? resto.split(/\n+/) : []];
}

function Firma({ review }: { review: GoogleReview }) {
  const nombre = review.authorProfileUrl ? (
    <a
      href={review.authorProfileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold underline-offset-4 hover:text-accent-ink hover:underline"
    >
      {review.author}
      <span className="sr-only"> (perfil de Google, se abre en una pestaña nueva)</span>
    </a>
  ) : (
    <span className="font-semibold">{review.author}</span>
  );
  return (
    <p className="t-chico">
      {nombre}
      <span className="block text-tinta-suave">Reseña en Google, {review.tiempoRelativo}</span>
    </p>
  );
}

/**
 * La prueba social como una carta: la reseña más larga se lee completa,
 * con su primera oración en grande y la firma del cliente al final. Al
 * lado, el promedio real de Google en cifra grande.
 */
export default async function ResenaCarta() {
  const { rating, totalReseñas, reviews } = await getGoogleReviews();
  const buenas = reviews.filter((r) => r.rating >= RATING_MINIMO);
  const [destacada, ...resto] = [...buenas].sort((a, b) => b.texto.length - a.texto.length);
  const ratingTexto = rating?.toLocaleString('es-CO', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const [apertura, parrafos] = destacada ? partir(destacada.texto) : [null, []];

  return (
    <section id="resenas" aria-labelledby="titulo-resenas" className="seccion">
      <div className="grid gap-14 lg:grid-cols-12 lg:gap-x-[var(--margen)]">
        <div data-entrada className="min-w-0 lg:col-span-4">
          <h2 id="titulo-resenas" style={escalon(0)} className="entra t-titulo">
            Lo que cuentan en Google
          </h2>
          {rating !== null && ratingTexto && (
            <div style={escalon(1)} className="entra mt-10">
              <p className="t-display tabular-nums">
                {ratingTexto}
                <span className="sr-only"> de 5 estrellas</span>
              </p>
              <div className="mt-4">
                <Estrellas valor={rating} />
              </div>
              {totalReseñas !== null && (
                <p className="t-cuerpo mt-3">Promedio de {totalReseñas} reseñas en Google.</p>
              )}
            </div>
          )}
          <p style={escalon(2)} className="entra t-cuerpo mt-8">
            <a
              href={NEGOCIO.googleReviews}
              target="_blank"
              rel="noopener noreferrer"
              className="enlace font-semibold"
            >
              Leer todas las reseñas
              <span className="sr-only"> (se abre en Google Maps)</span>
            </a>
          </p>
          <p style={escalon(3)} className="entra t-cuerpo mt-6 max-w-[34ch]">
            También nos recomiendan en{' '}
            {RECOMENDACIONES.map((r, i) => (
              <span key={r.nombre}>
                {i > 0 && ' y '}
                <a href={r.href} target="_blank" rel="noopener noreferrer" className="enlace">
                  {r.nombre}
                </a>
              </span>
            ))}
            .
          </p>
        </div>

        <div className="min-w-0 lg:col-span-7 lg:col-start-6">
          {destacada ? (
            <>
              <figure data-entrada className="max-w-[44ch]">
                <blockquote>
                  {apertura && (
                    <p style={escalon(0)} className="entra t-entrada font-medium text-balance">
                      {apertura}
                    </p>
                  )}
                  {parrafos.map((p, i) => (
                    <p key={i} style={escalon(i + 1)} className="entra t-cuerpo mt-5">
                      {p}
                    </p>
                  ))}
                </blockquote>
                <figcaption style={escalon(parrafos.length + 1)} className="entra mt-10">
                  <Firma review={destacada} />
                </figcaption>
              </figure>

              {resto.length > 0 && (
                <div data-entrada className="mt-20 grid gap-12 sm:grid-cols-2 sm:gap-x-[var(--margen)]">
                  {resto.slice(0, resto.length >= 4 ? 4 : 2).map((r, i) => (
                    <figure key={r.id} style={escalon(i)} className="entra min-w-0">
                      <blockquote className="t-cuerpo">
                        <p>{r.texto}</p>
                      </blockquote>
                      <figcaption className="mt-4">
                        <Firma review={r} />
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div data-entrada>
              <p className="entra t-entrada">
                Las reseñas de nuestros clientes están en nuestro perfil de Google.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
