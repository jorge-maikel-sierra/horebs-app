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

function MedalIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="6" />
      <path d="m8.21 13.89-1.21 9.11 5-3 5 3-1.21-9.11" />
    </svg>
  );
}

export default function PremiosSection() {
  return (
    <section className="px-6 py-16 text-center">
      <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl dark:text-zinc-50">
        Nos recomiendan
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-zinc-600 dark:text-zinc-400">
        Reconocidos por plataformas de gastronomía en Riohacha.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
        {PREMIOS.map((premio) => (
          <a
            key={premio.nombre}
            href={premio.href}
            target="_blank"
            rel="noopener noreferrer"
            className="card-interactive card-gradient flex w-44 flex-col items-center gap-2 rounded-2xl border border-zinc-200 px-6 py-8 dark:border-zinc-800"
          >
            <span className="btn-gradient flex h-12 w-12 items-center justify-center rounded-full text-white shadow-sm">
              <MedalIcon />
            </span>
            <span className="mt-1 font-semibold text-zinc-900 dark:text-zinc-50">
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
