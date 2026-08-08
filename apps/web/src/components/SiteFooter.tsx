import { NEGOCIO } from '@/lib/negocio';

export default function SiteFooter() {
  return (
    <footer className="border-t border-zinc-200 px-6 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
      <div className="flex items-center justify-center gap-6">
        <a
          href={NEGOCIO.facebook}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold hover:text-brand-orange"
        >
          Facebook
        </a>
        <a
          href={NEGOCIO.instagram}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold hover:text-brand-orange"
        >
          Instagram
        </a>
      </div>
      <p className="mt-4">{NEGOCIO.nombre} — {NEGOCIO.direccion}</p>
    </footer>
  );
}
