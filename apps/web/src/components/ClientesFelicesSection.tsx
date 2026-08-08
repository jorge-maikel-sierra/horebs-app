import { NEGOCIO } from '@/lib/negocio';

export default function ClientesFelicesSection() {
  return (
    <section className="border-t border-zinc-200 px-6 py-12 text-center dark:border-zinc-800">
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Clientes felices
      </h2>
      <p className="mx-auto mt-3 max-w-md text-zinc-600 dark:text-zinc-400">
        Nos encanta que vuelvan. Mirá las reseñas reales de nuestros
        clientes en Google.
      </p>
      <a
        href={NEGOCIO.googleReviews}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-block rounded-lg bg-brand-orange px-6 py-3 font-semibold text-white transition hover:opacity-90"
      >
        Ver reseñas en Google
      </a>
    </section>
  );
}
