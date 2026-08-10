'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatPrecio } from '@/lib/formato';

type InformeDia = { fecha: string; total: number; pedidos: number };
type InformeDesglose = { clave: string; total: number; pedidos: number };
type InformeProducto = { nombre: string; cantidad: number; total: number };
type InformeCategoria = { nombre: string; cantidad: number; total: number };
type InformeClienteDia = { fecha: string; nuevos: number };
type InformeClienteTop = {
  id: string;
  nombre: string;
  telefono: string | null;
  pedidos: number;
  total: number;
};

type InformeDto = {
  desde: string;
  hasta: string;
  resumen: {
    ventas_brutas: number;
    promedio_diario: number;
    pedidos: number;
    articulos_vendidos: number;
    ticket_promedio: number;
    costo_domicilio_total: number;
  };
  serie_diaria: InformeDia[];
  por_metodo_pago: InformeDesglose[];
  por_modalidad: InformeDesglose[];
  por_canal: InformeDesglose[];
  top_productos: InformeProducto[];
  por_categoria: InformeCategoria[];
  clientes: {
    nuevos: number;
    recurrentes: number;
    ticket_promedio: number;
    serie_diaria_nuevos: InformeClienteDia[];
    top_clientes: InformeClienteTop[];
  };
};

type RangoPreset = 'hoy' | '7dias' | 'mes' | 'mes_pasado' | 'anio' | 'personalizado';

const PRESETS: { key: RangoPreset; label: string }[] = [
  { key: 'hoy', label: 'Hoy' },
  { key: '7dias', label: 'Últimos 7 días' },
  { key: 'mes', label: 'Este mes' },
  { key: 'mes_pasado', label: 'Mes pasado' },
  { key: 'anio', label: 'Año' },
];

const METODO_PAGO_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
};

const MODALIDAD_LABEL: Record<string, string> = {
  domicilio: 'Domicilio',
  retiro: 'Para llevar',
  local: 'Comer en el local',
};

const CANAL_LABEL: Record<string, string> = {
  web: 'Pedidos web',
  pos: 'Mostrador (POS)',
};

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function calcularRango(preset: RangoPreset): { desde: string; hasta: string } {
  const hoy = new Date();
  switch (preset) {
    case 'hoy':
      return { desde: iso(hoy), hasta: iso(hoy) };
    case '7dias': {
      const desde = new Date(hoy);
      desde.setDate(desde.getDate() - 6);
      return { desde: iso(desde), hasta: iso(hoy) };
    }
    case 'mes': {
      const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      return { desde: iso(desde), hasta: iso(hoy) };
    }
    case 'mes_pasado': {
      const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const hasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
      return { desde: iso(desde), hasta: iso(hasta) };
    }
    case 'anio': {
      const desde = new Date(hoy.getFullYear(), 0, 1);
      return { desde: iso(desde), hasta: iso(hoy) };
    }
    default:
      return { desde: iso(hoy), hasta: iso(hoy) };
  }
}

function formatDiaCorto(fechaISO: string) {
  if (fechaISO.length === 7) {
    return new Intl.DateTimeFormat('es-CO', { month: 'short', year: 'numeric' })
      .format(new Date(`${fechaISO}-01T00:00:00`))
      .replace('.', '');
  }
  return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short' })
    .format(new Date(`${fechaISO}T00:00:00`))
    .replace('.', '');
}

function IconMoneda() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.5c0-1.4 1.2-2.2 2.7-2.2 1.6 0 2.8.9 2.8 2 0 3-5.5 1.5-5.5 4.4 0 1.2 1.2 2.1 2.8 2.1 1.5 0 2.7-.8 2.7-2.2" />
    </svg>
  );
}

function IconTendencia() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </svg>
  );
}

function IconPedidosIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h10a1 1 0 0 1 1 1v16l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1Z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  );
}

function IconArticulos() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8 12 3 3 8l9 5 9-5Z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  );
}

function IconTicket() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z" />
      <path d="M9 6v12" strokeDasharray="2 2" />
    </svg>
  );
}

function IconMoto() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="17" r="3" />
      <circle cx="18" cy="17" r="3" />
      <path d="M6 17 9 9h4l2 4h3" />
      <path d="M9 9 8 6H6" />
    </svg>
  );
}

function IconClienteNuevo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M18 8v6M15 11h6" />
    </svg>
  );
}

function IconClienteRecurrente() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M17 8a3 3 0 1 1-1 5.8" />
      <path d="M20 8v3h-3" />
    </svg>
  );
}

function TarjetaMetrica({
  icon: Icon,
  label,
  valor,
  detalle,
}: {
  icon: () => React.ReactElement;
  label: string;
  valor: string;
  detalle?: string;
}) {
  return (
    <div className="card-gradient card-interactive min-w-0 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="flex min-w-0 items-center gap-2 text-brand-orange">
        <span className="shrink-0">
          <Icon />
        </span>
        <span className="truncate text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          {label}
        </span>
      </div>
      <p className="mt-2 min-w-0 [overflow-wrap:anywhere] text-xl font-bold tabular-nums text-zinc-900 sm:text-2xl xl:text-[1.7rem] dark:text-zinc-50">
        {valor}
      </p>
      {detalle && (
        <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
          {detalle}
        </p>
      )}
    </div>
  );
}

const ALTURA_GRAFICO = 170;

function GraficoVentasDiarias({ datos }: { datos: InformeDia[] }) {
  const max = Math.max(1, ...datos.map((d) => d.total));
  const paso = Math.max(1, Math.ceil(datos.length / 15));
  return (
    <div
      className="flex items-end gap-1 overflow-x-auto pt-8 pb-1"
      style={{ minHeight: ALTURA_GRAFICO + 28 }}
    >
      {datos.map((d, idx) => (
        <div
          key={d.fecha}
          className="group relative flex min-w-[22px] flex-1 flex-col items-center justify-end"
        >
          <div className="pointer-events-none absolute -top-7 z-10 hidden rotate-0 rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-semibold whitespace-nowrap text-white group-hover:block dark:bg-zinc-100 dark:text-zinc-900">
            {formatPrecio(d.total)}
          </div>
          <div
            className="w-full max-w-8 rounded-t-md"
            style={{
              height: Math.max((d.total / max) * ALTURA_GRAFICO, 3),
              backgroundImage:
                'linear-gradient(180deg, var(--brand-orange), color-mix(in srgb, var(--brand-orange) 55%, var(--brand-yellow)))',
            }}
          />
          <span className="mt-1.5 text-[10px] whitespace-nowrap text-zinc-500 dark:text-zinc-400">
            {idx % paso === 0 ? formatDiaCorto(d.fecha) : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

function GraficoClientesNuevos({ datos }: { datos: InformeClienteDia[] }) {
  const max = Math.max(1, ...datos.map((d) => d.nuevos));
  const paso = Math.max(1, Math.ceil(datos.length / 15));
  return (
    <div
      className="flex items-end gap-1 overflow-x-auto pt-8 pb-1"
      style={{ minHeight: ALTURA_GRAFICO + 28 }}
    >
      {datos.map((d, idx) => (
        <div
          key={d.fecha}
          className="group relative flex min-w-[22px] flex-1 flex-col items-center justify-end"
        >
          <div className="pointer-events-none absolute -top-7 z-10 hidden rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-semibold whitespace-nowrap text-white group-hover:block dark:bg-zinc-100 dark:text-zinc-900">
            {d.nuevos} nuevo{d.nuevos === 1 ? '' : 's'}
          </div>
          <div
            className="w-full max-w-8 rounded-t-md"
            style={{
              height: Math.max((d.nuevos / max) * ALTURA_GRAFICO, 3),
              backgroundImage:
                'linear-gradient(180deg, var(--brand-navy), color-mix(in srgb, var(--brand-navy) 55%, white))',
            }}
          />
          <span className="mt-1.5 text-[10px] whitespace-nowrap text-zinc-500 dark:text-zinc-400">
            {idx % paso === 0 ? formatDiaCorto(d.fecha) : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

function ListaTopClientes({ clientes }: { clientes: InformeClienteTop[] }) {
  if (clientes.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Sin clientes activos en este rango.
      </p>
    );
  }
  const max = Math.max(1, ...clientes.map((c) => c.total));
  return (
    <ol className="space-y-3">
      {clientes.map((c, idx) => (
        <li key={c.id} className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-orange/15 text-xs font-bold text-brand-orange">
            {idx + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate font-medium text-zinc-800 dark:text-zinc-200">
                {c.nombre || 'Cliente sin nombre'}
                {c.telefono && (
                  <span className="ml-1.5 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                    {c.telefono}
                  </span>
                )}
              </span>
              <span className="shrink-0 font-semibold text-zinc-900 dark:text-zinc-50">
                {formatPrecio(c.total)}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-brand-navy dark:bg-blue-400"
                style={{ width: `${(c.total / max) * 100}%` }}
              />
            </div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {c.pedidos} pedido{c.pedidos === 1 ? '' : 's'}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

function ListaDesglose({
  items,
  etiquetas,
}: {
  items: InformeDesglose[];
  etiquetas: Record<string, string>;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Sin datos en este rango.
      </p>
    );
  }
  const max = Math.max(1, ...items.map((i) => i.total));
  const totalGeneral = items.reduce((s, i) => s + i.total, 0) || 1;
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.clave}>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {etiquetas[i.clave] ?? i.clave}
            </span>
            <span className="shrink-0 font-semibold text-zinc-900 dark:text-zinc-50">
              {formatPrecio(i.total)}
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className="btn-gradient h-full rounded-full"
              style={{ width: `${(i.total / max) * 100}%` }}
            />
          </div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {Math.round((i.total / totalGeneral) * 100)}% · {i.pedidos} pedido
            {i.pedidos === 1 ? '' : 's'}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ListaTopProductos({ productos }: { productos: InformeProducto[] }) {
  if (productos.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Sin productos vendidos en este rango.
      </p>
    );
  }
  const max = Math.max(1, ...productos.map((p) => p.total));
  return (
    <ol className="space-y-3">
      {productos.map((p, idx) => (
        <li key={p.nombre} className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-orange/15 text-xs font-bold text-brand-orange">
            {idx + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate font-medium text-zinc-800 dark:text-zinc-200">
                {p.nombre}
              </span>
              <span className="shrink-0 font-semibold text-zinc-900 dark:text-zinc-50">
                {formatPrecio(p.total)}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-brand-navy dark:bg-blue-400"
                style={{ width: `${(p.total / max) * 100}%` }}
              />
            </div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {p.cantidad} unidad{p.cantidad === 1 ? '' : 'es'} vendida
              {p.cantidad === 1 ? '' : 's'}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

function ListaCategorias({ categorias }: { categorias: InformeCategoria[] }) {
  if (categorias.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Sin ventas por categoría en este rango.
      </p>
    );
  }
  const max = Math.max(1, ...categorias.map((c) => c.total));
  return (
    <ul className="space-y-3">
      {categorias.map((c) => (
        <li key={c.nombre}>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {c.nombre}
            </span>
            <span className="shrink-0 font-semibold text-zinc-900 dark:text-zinc-50">
              {formatPrecio(c.total)}
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(c.total / max) * 100}%`,
                backgroundColor: 'var(--brand-navy)',
              }}
            />
          </div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {c.cantidad} artículo{c.cantidad === 1 ? '' : 's'}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Panel({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
      <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
        {titulo}
      </h2>
      {subtitulo && (
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {subtitulo}
        </p>
      )}
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default function InformesPage() {
  const [preset, setPreset] = useState<RangoPreset>('7dias');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [informe, setInforme] = useState<InformeDto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback((d: string, h: string) => {
    setCargando(true);
    setError(null);
    adminFetch(`/informes?desde=${d}&hasta=${h}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.message ?? 'No se pudo cargar el informe.');
        }
        setInforme(await res.json());
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Error desconocido.'),
      )
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    const rango = calcularRango('7dias');
    setDesde(rango.desde);
    setHasta(rango.hasta);
    cargar(rango.desde, rango.hasta);
  }, [cargar]);

  function aplicarPreset(p: RangoPreset) {
    setPreset(p);
    if (p === 'personalizado') return;
    const rango = calcularRango(p);
    setDesde(rango.desde);
    setHasta(rango.hasta);
    cargar(rango.desde, rango.hasta);
  }

  function aplicarPersonalizado() {
    if (!desde || !hasta) return;
    setPreset('personalizado');
    cargar(desde, hasta);
  }

  const r = informe?.resumen;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
        Informes
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Métricas de ventas del negocio — web y mostrador.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => aplicarPreset(p.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              preset === p.key
                ? 'btn-gradient text-white shadow-sm'
                : 'border border-zinc-300 text-zinc-600 hover:border-brand-orange dark:border-zinc-700 dark:text-zinc-300'
            }`}
          >
            {p.label}
          </button>
        ))}

        <span className="mx-1 h-5 w-px bg-zinc-300 dark:bg-zinc-700" />

        <input
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          className="[color-scheme:light] dark:[color-scheme:dark] rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 shadow-sm transition-colors outline-none hover:border-brand-orange focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        />
        <span className="text-sm text-zinc-400">–</span>
        <input
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          className="[color-scheme:light] dark:[color-scheme:dark] rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 shadow-sm transition-colors outline-none hover:border-brand-orange focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        />
        <button
          type="button"
          onClick={aplicarPersonalizado}
          className="btn-press rounded-xl border border-zinc-300 px-3.5 py-1.5 text-sm font-semibold text-zinc-600 shadow-sm transition-colors hover:border-brand-orange hover:text-brand-orange dark:border-zinc-700 dark:text-zinc-300"
        >
          Aplicar
        </button>
      </div>

      {cargando && (
        <p className="mt-8 text-sm text-zinc-500 dark:text-zinc-400">
          Cargando informe…
        </p>
      )}
      {error && <p className="mt-8 text-sm text-red-600">{error}</p>}

      {!cargando && !error && informe && r && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <TarjetaMetrica
              icon={IconMoneda}
              label="Ventas brutas"
              valor={formatPrecio(r.ventas_brutas)}
            />
            <TarjetaMetrica
              icon={IconTendencia}
              label="Promedio diario"
              valor={formatPrecio(r.promedio_diario)}
            />
            <TarjetaMetrica
              icon={IconPedidosIcon}
              label="Pedidos"
              valor={String(r.pedidos)}
            />
            <TarjetaMetrica
              icon={IconArticulos}
              label="Artículos vendidos"
              valor={String(r.articulos_vendidos)}
            />
            <TarjetaMetrica
              icon={IconTicket}
              label="Ticket promedio"
              valor={formatPrecio(r.ticket_promedio)}
            />
            <TarjetaMetrica
              icon={IconMoto}
              label="Domicilio cobrado"
              valor={formatPrecio(r.costo_domicilio_total)}
            />
          </div>

          <div className="mt-4">
            <Panel
              titulo="Ventas por día"
              subtitulo={`${informe.desde} a ${informe.hasta}`}
            >
              <GraficoVentasDiarias datos={informe.serie_diaria} />
            </Panel>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Panel titulo="Método de pago">
              <ListaDesglose
                items={informe.por_metodo_pago}
                etiquetas={METODO_PAGO_LABEL}
              />
            </Panel>
            <Panel titulo="Modalidad">
              <ListaDesglose
                items={informe.por_modalidad}
                etiquetas={MODALIDAD_LABEL}
              />
            </Panel>
            <Panel titulo="Canal de venta">
              <ListaDesglose items={informe.por_canal} etiquetas={CANAL_LABEL} />
            </Panel>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Panel
              titulo="Productos más vendidos"
              subtitulo="Ranking por ingresos en el período"
            >
              <ListaTopProductos productos={informe.top_productos} />
            </Panel>
            <Panel titulo="Ventas por categoría">
              <ListaCategorias categorias={informe.por_categoria} />
            </Panel>
          </div>

          <h2 className="mt-8 text-lg font-bold text-zinc-900 dark:text-zinc-50">
            Clientes
          </h2>

          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <TarjetaMetrica
              icon={IconClienteNuevo}
              label="Clientes nuevos"
              valor={String(informe.clientes.nuevos)}
              detalle="Primera compra en este período"
            />
            <TarjetaMetrica
              icon={IconClienteRecurrente}
              label="Clientes recurrentes"
              valor={String(informe.clientes.recurrentes)}
              detalle="Ya habían comprado antes"
            />
            <TarjetaMetrica
              icon={IconTicket}
              label="Ticket promedio por cliente"
              valor={formatPrecio(informe.clientes.ticket_promedio)}
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Panel
              titulo="Clientes nuevos por día"
              subtitulo="Primera compra registrada"
            >
              <GraficoClientesNuevos datos={informe.clientes.serie_diaria_nuevos} />
            </Panel>
            <Panel
              titulo="Clientes con más gasto"
              subtitulo="Ranking por total comprado en el período"
            >
              <ListaTopClientes clientes={informe.clientes.top_clientes} />
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
