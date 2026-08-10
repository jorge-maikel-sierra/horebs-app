import { NEGOCIO } from '@/lib/negocio';
import { getGoogleReviews } from '@/lib/google-reviews';
import ReviewsMarquee from './ReviewsMarquee';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
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

export default async function ClientesFelicesSection() {
  const { reviews, rating, totalReseñas } = await getGoogleReviews();

  return (
    <section className="py-16">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl dark:text-zinc-50">
          Clientes felices
        </h2>
        <p className="mx-auto mt-3 max-w-md text-zinc-600 dark:text-zinc-400">
          Nos encanta que vuelvan. Mirá las reseñas reales de nuestros
          clientes en Google.
        </p>
        {rating !== null && (
          <div className="mt-3 flex items-center justify-center gap-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            <span className="text-brand-orange">{rating.toFixed(1)} ★</span>
            {totalReseñas !== null && (
              <span className="font-normal text-zinc-500 dark:text-zinc-400">
                ({totalReseñas} reseñas en Google)
              </span>
            )}
          </div>
        )}
      </div>

      {reviews.length > 0 ? (
        <div className="mt-8">
          <ReviewsMarquee reviews={reviews} />
          <div className="mt-7 flex justify-center px-6">
            <a
              href={NEGOCIO.googleReviews}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-press btn-gradient inline-flex items-center gap-2 rounded-lg px-6 py-3 font-semibold text-white shadow-sm transition hover:opacity-90"
            >
              <GoogleIcon />
              Ver todas las reseñas
            </a>
          </div>
        </div>
      ) : (
        <div className="card-gradient-featured relative mx-auto mt-8 max-w-2xl overflow-hidden rounded-3xl border border-brand-orange/25 px-8 py-10 text-center shadow-lg shadow-zinc-900/5 dark:shadow-black/30">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-2 left-6 font-serif text-8xl leading-none text-brand-orange/15 select-none"
          >
            &ldquo;
          </span>
          <a
            href={NEGOCIO.googleReviews}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-press btn-gradient relative inline-flex items-center gap-2 rounded-lg px-6 py-3 font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            <GoogleIcon />
            Ver reseñas en Google
          </a>
        </div>
      )}
    </section>
  );
}
