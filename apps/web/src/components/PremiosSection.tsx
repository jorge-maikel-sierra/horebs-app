const PREMIOS = [
  {
    nombre: 'Sluurpy',
    etiqueta: 'Recomendado 2023',
    href: 'https://co.sluurpy.com/riohacha/restaurante/7921075/pizzeria-horebs',
  },
  {
    nombre: 'Restaurant Guru',
    etiqueta: 'Recomendado 2023',
    href: 'https://restaurantguru.com/Horebs-Riohacha',
  },
] as const;

export default function PremiosSection() {
  return (
    <section className="border-t border-zinc-200 px-6 py-12 text-center dark:border-zinc-800">
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Nos recomiendan
      </h2>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-6">
        {PREMIOS.map((premio) => (
          <a
            key={premio.nombre}
            href={premio.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-36 w-36 flex-col items-center justify-center gap-1 rounded-full border-4 border-brand-orange p-4 text-center transition hover:opacity-90"
          >
            <span className="text-xs font-bold text-brand-orange">★★★</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">
              {premio.nombre}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {premio.etiqueta}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
