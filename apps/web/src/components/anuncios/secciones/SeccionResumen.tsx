'use client';

import NumeroAnimado from '@/components/informes/NumeroAnimado';
import Panel from '@/components/informes/Panel';
import RankingBarras from '@/components/informes/RankingBarras';
import { TarjetaKpi } from '@/components/informes/TarjetasResumen';
import { IconMegafono, IconMoneda, IconPedidos, IconPorcentaje, IconTendencia } from '@/components/informes/iconos';
import { plural } from '@/components/informes/informes.tipos';
import { formatPrecio } from '@/lib/formato';
import {
  conversionOrigen,
  fechaCorta,
  nombreOrigen,
  pedidosValidos,
  pesos,
  porcentaje,
  veces,
  type General,
  type Origen,
  type Tablero,
  type VistaAnuncios,
} from '@/components/anuncios/anuncios.tipos';

const TOP_CAMPANAS = 5;

// Fuera del componente: NumeroAnimado vuelve a animar si cambia la función.
const formatoRetorno = (n: number) => veces(n);
const formatoRetornoParcial = (n: number) => `${Math.round(n)}x`;

function BarraComparada({ etiqueta, valor, max, tenue }: { etiqueta: string; valor: number; max: number; tenue?: boolean }) {
  return (
    <div>
      <dt className="flex items-baseline justify-between gap-3 text-xs text-white/85">
        <span>{etiqueta}</span>
        <span className="font-bold text-white tabular-nums">{formatPrecio(valor)}</span>
      </dt>
      <dd className="mt-1 h-2 overflow-hidden rounded-full bg-white/20">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${tenue ? 'bg-white/55' : 'bg-white'}`}
          style={{ width: `${Math.max(valor > 0 ? 1.5 : 0, (valor / max) * 100)}%` }}
        />
      </dd>
    </div>
  );
}

/** La pregunta del dueño: ¿lo que se gasta en Meta vuelve? */
function HeroRetorno({ g }: { g: General }) {
  const max = Math.max(1, g.gasto_total, g.ventas_totales);
  return (
    <div className="btn-gradient relative flex h-full min-h-56 flex-col justify-between overflow-hidden rounded-3xl p-5 text-white shadow-lg shadow-brand-orange/25 sm:p-6 @4xl:col-span-5">
      <span className="pointer-events-none absolute -top-16 -right-12 h-48 w-48 rounded-full bg-white/10" />
      <span className="pointer-events-none absolute top-28 -left-10 h-32 w-32 rounded-full bg-white/5" />
      <div className="relative">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <IconMegafono />
          </span>
          <span className="text-xs font-bold tracking-widest uppercase">Retorno de los anuncios</span>
        </div>
        {g.roas_general === null ? (
          <>
            <p className="mt-4 text-3xl leading-tight font-extrabold tracking-tight">Sin gasto sincronizado</p>
            <p className="mt-2 max-w-sm text-sm text-white/90">
              Sincroniza con Meta para ver cuánto vuelve por cada peso invertido.
            </p>
          </>
        ) : (
          <>
            <p className="mt-4 text-5xl leading-none font-extrabold tracking-tight tabular-nums sm:text-6xl">
              <NumeroAnimado valor={g.roas_general} formato={formatoRetorno} formatoParcial={formatoRetornoParcial} />
            </p>
            <p className="mt-2 max-w-sm text-sm text-white/90">
              Cada {formatPrecio(1000)} en anuncios trajo{' '}
              <strong className="font-bold text-white">{formatPrecio(Math.round(g.roas_general * 1000))}</strong> en
              ventas de todos los canales.
            </p>
          </>
        )}
      </div>
      <dl className="relative mt-6 space-y-3">
        <BarraComparada etiqueta="Ventas" valor={g.ventas_totales} max={max} />
        <BarraComparada etiqueta="Gasto en anuncios" valor={g.gasto_total} max={max} tenue />
      </dl>
    </div>
  );
}

function TiraTotales({ origenes }: { origenes: Origen[] }) {
  const t = origenes.reduce(
    (s, o) => ({
      conversaciones: s.conversaciones + o.conversaciones,
      pedidos: s.pedidos + pedidosValidos(o),
      ventas: s.ventas + o.ventas,
    }),
    { conversaciones: 0, pedidos: 0, ventas: 0 },
  );
  const cifras = [
    ['Conversaciones', String(t.conversaciones)],
    ['Pedidos', String(t.pedidos)],
    ['Ventas', formatPrecio(t.ventas)],
  ];
  return (
    <dl className="mb-5 grid grid-cols-3 divide-x divide-zinc-200 rounded-xl bg-zinc-50 py-3 dark:divide-zinc-800 dark:bg-zinc-900/70">
      {cifras.map(([e, v]) => (
        <div key={e} className="flex min-w-0 flex-col-reverse px-2 text-center">
          <dt className="text-[11px] text-zinc-500 dark:text-zinc-400">{e}</dt>
          <dd className="text-sm font-extrabold text-zinc-900 tabular-nums [overflow-wrap:anywhere] @md:text-base @xl:text-lg dark:text-zinc-50">
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const TIPO_ORIGEN: Record<Origen['tipo'], string> = { anuncio: 'Anuncio', enlace: 'Enlace', otro: '' };

export default function SeccionResumen({
  tablero,
  onIrA,
}: {
  tablero: Tablero;
  onIrA: (v: VistaAnuncios) => void;
}) {
  const g = tablero.general;
  const atribuidos = g.pedidos_totales > 0 ? Math.round((g.pedidos_atribuidos / g.pedidos_totales) * 100) : null;
  const origenes = [...tablero.origenes].sort((a, b) => b.ventas - a.ventas);
  const campanas = [...tablero.campanas].sort((a, b) => b.ventas - a.ventas).slice(0, TOP_CAMPANAS);

  return (
    <div className="mt-5 grid gap-3 @2xl:gap-4 @4xl:grid-cols-12">
      <HeroRetorno g={g} />
      <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4 @2xl:gap-4 @4xl:col-span-7 @4xl:grid-cols-2">
        <TarjetaKpi
          tono="azul"
          icono={<IconMoneda />}
          label="Gasto en anuncios"
          valor={formatPrecio(g.gasto_total)}
          detalle={tablero.gasto_hasta ? `Meta al día hasta el ${fechaCorta(tablero.gasto_hasta)}` : 'Sin gasto sincronizado'}
        />
        <TarjetaKpi
          tono="verde"
          icono={<IconTendencia />}
          label="Utilidad tras anuncios"
          valor={pesos(g.utilidad_tras_anuncios)}
          detalle={
            g.utilidad_tras_anuncios === null
              ? 'Carga costos en Costos y margen'
              : `Utilidad bruta ${formatPrecio(g.utilidad_bruta)}`
          }
        />
        <TarjetaKpi
          tono="naranja"
          icono={<IconPedidos />}
          label="Pedidos atribuidos"
          valor={String(g.pedidos_atribuidos)}
          detalle={`de ${plural(g.pedidos_totales, 'pedido')}${atribuidos === null ? '' : ` (${atribuidos}%)`}`}
        />
        <TarjetaKpi
          tono="amarillo"
          icono={<IconPorcentaje />}
          label="Margen"
          valor={porcentaje(g.margen_pct)}
          detalle={
            g.cobertura_costos === null
              ? 'Sin costos cargados'
              : `Con costo el ${g.cobertura_costos}% de las ventas`
          }
        />
      </div>

      <Panel
        className="@4xl:col-span-7"
        titulo="De dónde llegan los clientes"
        subtitulo="Anuncio o enlace desde el que le escribieron al bot"
      >
        {origenes.length > 0 && <TiraTotales origenes={origenes} />}
        <RankingBarras
          tono="naranja"
          vacio="Aparecen cuando alguien escribe al bot desde un anuncio o un enlace m.me / ig.me con ref (por ejemplo, el QR de la caja)."
          filas={origenes.map((o) => ({
            clave: o.clave,
            etiqueta: nombreOrigen(o),
            extra: TIPO_ORIGEN[o.tipo] || undefined,
            valor: o.ventas,
            detalle: `${plural(o.conversaciones, 'conversación', 'conversaciones')} · ${plural(pedidosValidos(o), 'pedido')} · ${conversionOrigen(o)} conversión`,
          }))}
        />
        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          Las conversaciones cuentan por su primer anuncio o enlace; los pedidos, por el último antes de pedir.
          Los cancelados no suman.
        </p>
      </Panel>

      <Panel
        className="@4xl:col-span-5"
        titulo="Campañas que más venden"
        subtitulo="Ventas de los pedidos atribuidos"
        accionEnLinea
        accion={
          tablero.campanas.length > 0 && (
            <button
              type="button"
              onClick={() => onIrA('campanas')}
              className="h-8 rounded-lg px-2.5 text-xs font-semibold text-accent-ink transition-colors hover:bg-brand-orange/10 focus-visible:ring-2 focus-visible:ring-brand-orange/60 focus-visible:outline-none"
            >
              Ver todas →
            </button>
          )
        }
      >
        <RankingBarras
          numerado
          tono="azul"
          vacio="Todavía no hay campañas con gasto en este rango."
          filas={campanas.map((c) => ({
            clave: c.campana_id,
            etiqueta: c.nombre,
            valor: c.ventas,
            detalle: `Retorno ${veces(c.roas)} · gasto ${formatPrecio(c.gasto)}`,
          }))}
        />
      </Panel>
    </div>
  );
}
