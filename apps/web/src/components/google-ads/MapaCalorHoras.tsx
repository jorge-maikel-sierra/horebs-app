import { formatPrecio } from '@/lib/formato';
import type { CeldaHora } from '@/components/google-ads/google-ads.tipos';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const HORAS = Array.from({ length: 24 }, (_, h) => h);
// El local atiende de 4:00 p.m. a 11:00 p.m. (CLAUDE.md).
const APERTURA = 16;
const CIERRE = 23;

function etiquetaHora(h: number): string {
  const sufijo = h < 12 ? 'a' : 'p';
  return `${h % 12 === 0 ? 12 : h % 12}${sufijo}`;
}

/**
 * Gasto por día de semana y hora en una sola tonalidad (naranja de marca):
 * más intenso = más gasto. La franja del horario del local va marcada y cada
 * celda dice su valor al lector de pantalla; la tabla sr-only es la versión
 * accesible completa.
 */
export default function MapaCalorHoras({ celdas }: { celdas: CeldaHora[] }) {
  const mapa = new Map(celdas.map((c) => [`${c.dia}:${c.hora}`, c]));
  const max = Math.max(1, ...celdas.map((c) => c.gasto));
  const total = celdas.reduce((s, c) => s + c.gasto, 0);
  if (total === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Sin gasto por hora en este período.</p>;
  }
  return (
    <div>
      <div className="overflow-x-auto" aria-hidden="true">
        <div className="grid min-w-[640px] grid-cols-[2.5rem_repeat(24,minmax(0,1fr))] gap-0.5 text-[10px]">
          <span />
          {HORAS.map((h) => (
            <span
              key={h}
              className={`text-center tabular-nums ${
                h >= APERTURA && h < CIERRE ? 'font-bold text-zinc-800 dark:text-zinc-200' : 'text-zinc-400'
              }`}
            >
              {h % 3 === 0 ? etiquetaHora(h) : ''}
            </span>
          ))}
          {DIAS.map((dia, d) => (
            <div key={dia} className="contents">
              <span className="self-center text-zinc-500 dark:text-zinc-400">{dia}</span>
              {HORAS.map((h) => {
                const c = mapa.get(`${d}:${h}`);
                const intensidad = c ? c.gasto / max : 0;
                return (
                  <span
                    key={h}
                    title={`${dia} ${etiquetaHora(h)}: ${formatPrecio(c?.gasto ?? 0)} · ${c?.clics ?? 0} clics · ${c?.conversiones ?? 0} conv.`}
                    className={`h-6 rounded-[3px] ${
                      h >= APERTURA && h < CIERRE ? 'ring-1 ring-zinc-300 ring-inset dark:ring-zinc-700' : ''
                    } ${intensidad === 0 ? 'bg-zinc-100 dark:bg-zinc-900' : ''}`}
                    style={intensidad > 0 ? { backgroundColor: `rgb(235 104 52 / ${0.15 + intensidad * 0.85})` } : undefined}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Más oscuro = más gasto. Recuadradas: las horas del local (4 p.m. a 11 p.m.).
      </p>
      <table className="sr-only">
        <caption>Gasto por día y hora</caption>
        <thead>
          <tr>
            <th scope="col">Día</th>
            <th scope="col">Hora</th>
            <th scope="col">Gasto</th>
            <th scope="col">Clics</th>
            <th scope="col">Conversiones</th>
          </tr>
        </thead>
        <tbody>
          {celdas
            .filter((c) => c.gasto > 0)
            .map((c) => (
              <tr key={`${c.dia}:${c.hora}`}>
                <td>{DIAS[c.dia]}</td>
                <td>{etiquetaHora(c.hora)}</td>
                <td>{formatPrecio(c.gasto)}</td>
                <td>{c.clics}</td>
                <td>{c.conversiones}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
