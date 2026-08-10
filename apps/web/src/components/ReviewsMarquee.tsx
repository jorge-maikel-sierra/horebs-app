import Image from 'next/image';
import type { GoogleReview } from '@/lib/google-reviews';

function EstrellasIcon({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5 text-brand-orange" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill={i < Math.round(rating) ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="m12 2 2.9 6.6 7.1.6-5.4 4.8 1.7 7-6.3-3.8L5.7 21l1.7-7-5.4-4.8 7.1-.6Z" />
        </svg>
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: GoogleReview }) {
  const iniciales = review.author.charAt(0).toUpperCase();
  return (
    <div className="card-gradient flex w-72 shrink-0 flex-col gap-3 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="flex items-center gap-3">
        {review.authorPhoto ? (
          <Image
            src={review.authorPhoto}
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 rounded-full"
          />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-orange/15 text-sm font-semibold text-brand-orange">
            {iniciales}
          </div>
        )}
        <div className="min-w-0">
          {review.authorProfileUrl ? (
            <a
              href={review.authorProfileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-sm font-semibold text-zinc-900 transition-colors hover:text-brand-orange dark:text-zinc-50"
            >
              {review.author}
            </a>
          ) : (
            <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {review.author}
            </p>
          )}
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {review.tiempoRelativo}
          </p>
        </div>
      </div>
      <EstrellasIcon rating={review.rating} />
      <p className="line-clamp-4 text-sm text-zinc-600 dark:text-zinc-400">
        {review.texto}
      </p>
    </div>
  );
}

export default function ReviewsMarquee({ reviews }: { reviews: GoogleReview[] }) {
  // Duplicado para el loop -50% sin salto — ver comentario en globals.css.
  const track = [...reviews, ...reviews];

  return (
    <div className="marquee-fade overflow-hidden">
      <div className="marquee-track flex w-max gap-4">
        {track.map((review, i) => (
          <ReviewCard key={`${review.id}-${i}`} review={review} />
        ))}
      </div>
    </div>
  );
}
