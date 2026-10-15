import { IconFlechaDer, IconFlechaIzq } from './iconos';

const NUMERO = new Intl.NumberFormat('es-CO');

const BASE =
  'btn-press flex h-10 min-w-10 items-center justify-center gap-1 rounded-xl px-3 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60';

/** Páginas visibles: primera, última y la actual con sus vecinas; el resto, "…". */
function ventana(pagina: number, paginas: number): (number | null)[] {
  const visibles = new Set(
    [1, paginas, pagina - 1, pagina, pagina + 1].filter(
      (p) => p >= 1 && p <= paginas,
    ),
  );
  const orden = [...visibles].sort((a, b) => a - b);
  const salida: (number | null)[] = [];
  orden.forEach((p, i) => {
    if (i > 0 && p - orden[i - 1] > 1) salida.push(null);
    salida.push(p);
  });
  return salida;
}

export default function Paginacion({
  pagina,
  paginas,
  total,
  porPagina,
  onCambiar,
}: {
  pagina: number;
  paginas: number;
  total: number;
  porPagina: number;
  onCambiar: (pagina: number) => void;
}) {
  if (paginas <= 1) return null;
  const desde = (pagina - 1) * porPagina + 1;
  const hasta = Math.min(total, pagina * porPagina);

  return (
    <nav
      aria-label="Paginación de clientes"
      className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-between"
    >
      <p className="text-sm text-zinc-500 tabular-nums dark:text-zinc-400">
        {NUMERO.format(desde)}–{NUMERO.format(hasta)} de {NUMERO.format(total)}
      </p>
      <ul className="flex flex-wrap items-center justify-center gap-1">
        <li>
          <button
            type="button"
            disabled={pagina <= 1}
            onClick={() => onCambiar(pagina - 1)}
            className={`${BASE} text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800`}
          >
            <IconFlechaIzq />
            <span className="max-sm:sr-only">Anterior</span>
          </button>
        </li>
        {ventana(pagina, paginas).map((p, i) =>
          p === null ? (
            <li
              key={`e${i}`}
              aria-hidden="true"
              className="px-1 text-zinc-400 dark:text-zinc-500"
            >
              …
            </li>
          ) : (
            <li key={p}>
              <button
                type="button"
                aria-current={p === pagina ? 'page' : undefined}
                aria-label={`Página ${p}`}
                onClick={() => onCambiar(p)}
                className={`${BASE} tabular-nums ${
                  p === pagina
                    ? 'btn-gradient text-white shadow-md shadow-brand-orange/25'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                {p}
              </button>
            </li>
          ),
        )}
        <li>
          <button
            type="button"
            disabled={pagina >= paginas}
            onClick={() => onCambiar(pagina + 1)}
            className={`${BASE} text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800`}
          >
            <span className="max-sm:sr-only">Siguiente</span>
            <IconFlechaDer />
          </button>
        </li>
      </ul>
    </nav>
  );
}
