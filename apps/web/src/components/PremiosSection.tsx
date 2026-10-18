const PREMIOS = [
  {
    nombre: 'Sluurpy',
    etiqueta: 'Restaurante recomendado',
    href: 'https://co.sluurpy.com/riohacha/restaurante/7921075/pizzeria-horebs',
  },
  {
    nombre: 'Restaurant Guru',
    etiqueta: 'Restaurante recomendado',
    href: 'https://restaurantguru.com/Horebs-Riohacha',
  },
] as const;

// Hojas de una rama de laurel a lo largo de un arco: [x, y, rotación].
const HOJAS: [number, number, number][] = [
  [17, 52, -10],
  [12, 43, -28],
  [9.5, 33, -45],
  [10, 23, -62],
  [13, 14, -80],
];

/** Rama de laurel; la derecha es la misma espejada. */
function Laurel({ espejo = false }: { espejo?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 30 60"
      className={`h-14 w-7 shrink-0 text-brand-yellow-600 dark:text-brand-yellow-500 ${espejo ? '-scale-x-100' : ''}`}
      fill="currentColor"
    >
      <path d="M22 58C12 50 7 38 9 24S16 6 20 3" fill="none" stroke="currentColor" strokeWidth="1.2" />
      {HOJAS.map(([x, y, r]) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y}) rotate(${r})`}>
          <ellipse cx="-4" cy="0" rx="4.6" ry="1.9" />
          <ellipse cx="3.8" cy="-1.5" rx="4.2" ry="1.7" transform="rotate(50 3.8 -1.5)" />
        </g>
      ))}
    </svg>
  );
}

/**
 * Banda de sellos al pie de "Clientes felices": las plataformas que
 * recomiendan a Horebs, con laureles en vez de una sección propia.
 */
export default function PremiosSection() {
  return (
    <div
      aria-labelledby="titulo-premios"
      role="group"
      className="mx-auto mt-20 flex max-w-6xl flex-col items-center gap-8 rounded-[2rem] border border-[var(--carta-linea)] bg-[var(--carta-tarjeta)] px-6 py-10 text-center sm:px-10 lg:flex-row lg:justify-between lg:text-left"
    >
      <div>
        <h3
          id="titulo-premios"
          className="font-display text-2xl text-zinc-900 sm:text-3xl dark:text-zinc-50"
        >
          También nos recomiendan
        </h3>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Plataformas de gastronomía de Riohacha.
        </p>
      </div>

      <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
        {PREMIOS.map((premio) => (
          <li key={premio.nombre}>
            <a
              href={premio.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-1 rounded-2xl px-2 py-1"
            >
              <Laurel />
              <span className="px-1 text-center">
                <span className="font-display block text-xl leading-tight text-zinc-900 transition-colors group-hover:text-accent-ink dark:text-zinc-50">
                  {premio.nombre}
                </span>
                <span className="mt-1 block text-[0.65rem] font-semibold tracking-[0.18em] text-zinc-500 uppercase dark:text-zinc-400">
                  {premio.etiqueta}
                </span>
              </span>
              <Laurel espejo />
              <span className="sr-only"> (se abre en una pestaña nueva)</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
