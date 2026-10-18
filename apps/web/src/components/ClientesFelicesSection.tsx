import Image from 'next/image';
import { NEGOCIO } from '@/lib/negocio';
import { getGoogleReviews, type GoogleReview } from '@/lib/google-reviews';
import PremiosSection from './PremiosSection';

// Esta sección es de testimonios: muestra solo las reseñas de 4 y 5
// estrellas. El promedio real y el enlace a todas las reseñas de Google
// siguen visibles, así que no se oculta nada al que quiera verlas.
const RATING_MINIMO_TESTIMONIO = 4;

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18A13.96 13.96 0 0 1 10.93 24c0-1.45.25-2.86.76-4.18v-5.7H4.34A21.98 21.98 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

const ESTRELLA = 'm12 2 2.9 6.6 7.1.6-5.4 4.8 1.7 7-6.3-3.8L5.7 21l1.7-7-5.4-4.8 7.1-.6Z';

/** Cinco estrellas con relleno parcial (4,7 llena el 94%). Solo visual. */
function Estrellas({ valor, className = 'h-4 w-4' }: { valor: number; className?: string }) {
  const fila = (relleno: boolean) =>
    Array.from({ length: 5 }).map((_, i) => (
      <svg
        key={i}
        viewBox="0 0 24 24"
        className={`${className} shrink-0`}
        fill={relleno ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d={ESTRELLA} />
      </svg>
    ));
  return (
    <span aria-hidden="true" className="relative inline-flex gap-1 text-brand-orange-500">
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

function Autor({
  review,
  sobreOscuro = false,
}: {
  review: GoogleReview;
  /** Sobre el navy de la cita destacada: textos claros y avatar más grande. */
  sobreOscuro?: boolean;
}) {
  const tam = sobreOscuro ? 'h-11 w-11' : 'h-9 w-9';
  const colorNombre = sobreOscuro ? 'text-white' : 'text-zinc-900 dark:text-zinc-50';
  const nombre = review.authorProfileUrl ? (
    <a
      href={review.authorProfileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`truncate font-semibold transition-colors ${colorNombre} ${
        sobreOscuro ? 'hover:text-brand-yellow-500' : 'hover:text-accent-ink'
      }`}
    >
      {review.author}
      <span className="sr-only"> (perfil de Google, se abre en una pestaña nueva)</span>
    </a>
  ) : (
    <span className={`truncate font-semibold ${colorNombre}`}>{review.author}</span>
  );

  return (
    <div className="flex min-w-0 items-center gap-3">
      {review.authorPhoto ? (
        <Image
          src={review.authorPhoto}
          alt=""
          width={44}
          height={44}
          className={`${tam} shrink-0 rounded-full`}
        />
      ) : (
        <span
          aria-hidden="true"
          className={`${tam} font-display flex shrink-0 items-center justify-center rounded-full bg-brand-orange-500/15 text-accent-ink`}
        >
          {review.author.charAt(0).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 text-sm">
        <p className="flex">{nombre}</p>
        <p className={sobreOscuro ? 'text-zinc-300' : 'text-zinc-500 dark:text-zinc-400'}>
          {review.tiempoRelativo}
        </p>
      </div>
    </div>
  );
}

function CitaDestacada({ review }: { review: GoogleReview }) {
  return (
    <figure className="relative overflow-hidden rounded-[2rem] bg-brand-navy p-8 text-white shadow-2xl shadow-brand-navy/30 sm:p-12">
      <div aria-hidden="true" className="hero-horno opacity-70" />
      <span
        aria-hidden="true"
        className="font-display pointer-events-none absolute -top-6 right-6 text-[10rem] leading-none text-brand-yellow-500/20 select-none"
      >
        &rdquo;
      </span>
      <div className="relative">
        <Estrellas valor={review.rating} className="h-5 w-5" />
        <p className="sr-only">{Math.round(review.rating)} de 5 estrellas</p>
        <blockquote className="font-display mt-6 line-clamp-6 text-2xl leading-snug sm:text-[2rem] sm:leading-[1.3]">
          &ldquo;{review.texto}&rdquo;
        </blockquote>
        <figcaption className="mt-8 border-t border-white/15 pt-6">
          <Autor review={review} sobreOscuro />
        </figcaption>
      </div>
    </figure>
  );
}

function TarjetaResena({ review }: { review: GoogleReview }) {
  return (
    <figure className="flex w-[17rem] shrink-0 snap-start flex-col rounded-3xl border border-[var(--carta-linea)] bg-[var(--carta-tarjeta)] p-6 sm:w-auto">
      <Estrellas valor={review.rating} className="h-3.5 w-3.5" />
      <p className="sr-only">{Math.round(review.rating)} de 5 estrellas</p>
      <blockquote className="mt-4 line-clamp-5 flex-1 leading-7 text-zinc-700 dark:text-zinc-300">
        {review.texto}
      </blockquote>
      <figcaption className="mt-6">
        <Autor review={review} />
      </figcaption>
    </figure>
  );
}

export default async function ClientesFelicesSection() {
  const datos = await getGoogleReviews();
  const { rating, totalReseñas } = datos;
  const reviews = datos.reviews.filter((r) => r.rating >= RATING_MINIMO_TESTIMONIO);
  // La más larga va de cita destacada: es la que más cuenta.
  const [destacada, ...resto] = [...reviews].sort((a, b) => b.texto.length - a.texto.length);
  const ratingTexto = rating?.toLocaleString('es-CO', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return (
    <section
      aria-labelledby="titulo-resenas"
      className="border-t border-[var(--carta-linea)] px-6 py-24 sm:py-32"
    >
      <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-32">
            <p className="flex items-center gap-3 text-xs font-semibold tracking-[0.25em] text-accent-ink uppercase">
              Lo que dicen en Google
              <span aria-hidden="true" className="h-px w-8 bg-current opacity-50" />
            </p>
            <h2
              id="titulo-resenas"
              className="font-display mt-5 text-balance text-4xl leading-[1.05] text-zinc-900 sm:text-5xl dark:text-zinc-50"
            >
              Clientes felices
            </h2>

            {rating !== null && ratingTexto && (
              <div className="mt-10">
                <p className="flex items-end gap-4">
                  <span className="font-display text-[5.5rem] leading-[0.8] text-zinc-900 tabular-nums sm:text-[7rem] dark:text-zinc-50">
                    {ratingTexto}
                  </span>
                  <span className="pb-1 text-lg text-zinc-500 dark:text-zinc-400">/ 5</span>
                  <span className="sr-only"> estrellas de promedio</span>
                </p>
                <div className="mt-4">
                  <Estrellas valor={rating} className="h-5 w-5" />
                </div>
                {totalReseñas !== null && (
                  <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                    Promedio de {totalReseñas} reseñas en Google
                  </p>
                )}
              </div>
            )}

            <a
              href={NEGOCIO.googleReviews}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-press mt-8 inline-flex items-center gap-2.5 rounded-full border border-[var(--carta-linea)] bg-[var(--carta-tarjeta)] px-5 py-3 text-sm font-semibold text-zinc-900 transition-colors hover:border-accent-ink hover:text-accent-ink dark:text-zinc-50"
            >
              <GoogleIcon className="h-4 w-4" />
              Ver todas las reseñas
              <span className="sr-only"> (se abre en Google Maps)</span>
            </a>
          </div>
        </div>

        <div className="lg:col-span-8">
          {destacada ? (
            <>
              <CitaDestacada review={destacada} />
              {resto.length > 0 && (
                <div
                  role="region"
                  aria-label="Más reseñas"
                  tabIndex={0}
                  className="-mx-6 mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-3"
                >
                  {resto.map((r) => (
                    <TarjetaResena key={r.id} review={r} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full min-h-64 flex-col items-start justify-center rounded-[2rem] border border-[var(--carta-linea)] bg-[var(--carta-tarjeta)] p-10">
              <p className="font-display text-3xl text-zinc-900 dark:text-zinc-50">
                Las reseñas viven en Google.
              </p>
              <p className="mt-3 text-zinc-600 dark:text-zinc-400">
                Lee lo que cuentan nuestros clientes en nuestro perfil.
              </p>
            </div>
          )}
        </div>
      </div>

      <PremiosSection />
    </section>
  );
}
