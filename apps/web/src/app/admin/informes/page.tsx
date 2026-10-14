'use client';

import { useCallback, useEffect, useState } from 'react';
import RequireRol from '@/components/RequireRol';
import { adminFetch } from '@/lib/admin-fetch';
import { formatPrecio } from '@/lib/formato';
import { sumarDias } from '@/lib/semana';
import CargandoSkeleton from '@/components/CargandoSkeleton';
import FiltroPeriodo, { type PresetOpcion } from '@/components/informes/FiltroPeriodo';
import GraficoColumnas, { COLOR_MARCA } from '@/components/informes/GraficoColumnas';
import {
  HeroVentas,
  TarjetaKpi,
  TiraDomicilio,
} from '@/components/informes/TarjetasResumen';
import {
  calcularDelta,
  diasEntre,
  etiquetaCorta,
  etiquetaLarga,
  etiquetaRango,
  formatoEjePesos,
  rangoAnterior,
} from '@/lib/informes-rango';

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

const PRESETS: PresetOpcion<RangoPreset>[] = [
  { key: 'hoy', corto: 'Hoy', largo: 'Hoy' },
  { key: '7dias', corto: '7 días', largo: 'Últimos 7 días' },
  { key: 'mes', corto: 'Este mes', largo: 'Este mes' },
  { key: 'mes_pasado', corto: 'Mes pasado', largo: 'Mes pasado' },
  { key: 'anio', corto: 'Año', largo: 'Este año' },
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

// El negocio opera en hora de Bogotá — usar toISOString() acá daría la
// fecha en UTC, que ya es "mañana" desde ~7pm hora local en adelante.
function iso(d: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(d);
}

// Todo el cálculo parte de la fecha de Bogotá como texto (YYYY-MM-DD) y usa
// aritmética de calendario pura: getFullYear()/getMonth() del navegador
// correrían el mes un día para quien mire el panel desde otra zona horaria.
function calcularRango(preset: RangoPreset): { desde: string; hasta: string } {
  const hoy = iso(new Date());
  const [anio, mes] = hoy.split('-').map(Number);
  const primeroDeMes = `${anio}-${String(mes).padStart(2, '0')}-01`;
  switch (preset) {
    case '7dias':
      return { desde: sumarDias(hoy, -6), hasta: hoy };
    case 'mes':
      return { desde: primeroDeMes, hasta: hoy };
    case 'mes_pasado': {
      const ultimoMesPasado = sumarDias(primeroDeMes, -1);
      return { desde: `${ultimoMesPasado.slice(0, 8)}01`, hasta: ultimoMesPasado };
    }
    case 'anio':
      return { desde: `${anio}-01-01`, hasta: hoy };
    default:
      return { desde: hoy, hasta: hoy };
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

function GraficoVentasDiarias({ datos }: { datos: InformeDia[] }) {
  return (
    <GraficoColumnas
      tono="naranja"
      nombreValor="Ventas"
      nombreDetalle="Pedidos"
      puntos={datos.map((d) => ({
        clave: d.fecha,
        etiqueta: etiquetaCorta(d.fecha),
        etiquetaLarga: etiquetaLarga(d.fecha),
        valor: d.total,
        detalle: `${d.pedidos} pedido${d.pedidos === 1 ? '' : 's'}`,
        valorDetalle: String(d.pedidos),
      }))}
      formatoValor={formatPrecio}
      formatoEje={formatoEjePesos}
    />
  );
}

function GraficoClientesNuevos({ datos }: { datos: InformeClienteDia[] }) {
  return (
    <GraficoColumnas
      tono="azul"
      nombreValor="Clientes nuevos"
      enteros
      puntos={datos.map((d) => ({
        clave: d.fecha,
        etiqueta: etiquetaCorta(d.fecha),
        etiquetaLarga: etiquetaLarga(d.fecha),
        valor: d.nuevos,
      }))}
      formatoValor={(n) => `${n} nuevo${n === 1 ? '' : 's'}`}
      formatoEje={(n) => String(n)}
    />
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
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-r-[4px] bg-zinc-100 dark:bg-zinc-800">
              <div
                className={`h-full rounded-r-[4px] ${COLOR_MARCA.azul}`}
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
          <div className="mt-1 h-2 w-full overflow-hidden rounded-r-[4px] bg-zinc-100 dark:bg-zinc-800">
            <div
              className={`h-full rounded-r-[4px] ${COLOR_MARCA.naranja}`}
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
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-r-[4px] bg-zinc-100 dark:bg-zinc-800">
              <div
                className={`h-full rounded-r-[4px] ${COLOR_MARCA.azul}`}
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
          <div className="mt-1 h-2 w-full overflow-hidden rounded-r-[4px] bg-zinc-100 dark:bg-zinc-800">
            <div
              className={`h-full rounded-r-[4px] ${COLOR_MARCA.azul}`}
              style={{ width: `${(c.total / max) * 100}%` }}
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
    <div className="min-w-0 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
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

function InformesPageInterno() {
  const [preset, setPreset] = useState<RangoPreset>('7dias');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [informe, setInforme] = useState<InformeDto | null>(null);
  const [anterior, setAnterior] = useState<InformeDto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback((d: string, h: string) => {
    setCargando(true);
    setError(null);

    async function pedir(desde: string, hasta: string): Promise<InformeDto> {
      const res = await adminFetch(`/informes?desde=${desde}&hasta=${hasta}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? 'No se pudo cargar el informe.');
      }
      return res.json();
    }

    // El período anterior solo alimenta las comparaciones (▲/▼): si falla,
    // el informe principal se muestra igual, sin porcentajes.
    const previo = rangoAnterior(d, h);
    Promise.all([pedir(d, h), pedir(previo.desde, previo.hasta).catch(() => null)])
      .then(([actual, ant]) => {
        setInforme(actual);
        setAnterior(ant);
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

  function aplicarPersonalizado(d: string, h: string) {
    setDesde(d);
    setHasta(h);
    setPreset('personalizado');
    cargar(d, h);
  }

  const r = informe?.resumen;
  const ra = anterior?.resumen;
  const dias = desde && hasta ? diasEntre(desde, hasta) : 0;
  const vs = `los ${dias} ${dias === 1 ? 'día' : 'días'} anteriores`;
  const mejorDia = informe?.serie_diaria.reduce<InformeDia | null>(
    (mejor, d) => (!mejor || d.total > mejor.total ? d : mejor),
    null,
  );
  const etiqueta = etiquetaRango(desde, hasta);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
            Informes
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Métricas de ventas del negocio — web y mostrador.
          </p>
        </div>
        {etiqueta && (
          <p className="rounded-full border border-zinc-200 bg-white/70 px-3 py-1 text-xs font-semibold text-zinc-600 tabular-nums dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
            {etiqueta}
            {dias > 1 && ` · ${dias} días`}
          </p>
        )}
      </header>

      <div className="sticky top-[61px] z-10 -mx-4 mt-4 border-b border-zinc-200/70 bg-white/80 px-4 py-2.5 backdrop-blur-md sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-8 lg:px-8 dark:border-zinc-800/70 dark:bg-zinc-950/80">
        <FiltroPeriodo
          presets={PRESETS}
          activo={preset}
          personalizadoKey="personalizado"
          desde={desde}
          hasta={hasta}
          onPreset={aplicarPreset}
          onRangoPersonalizado={aplicarPersonalizado}
        />
      </div>

      {cargando && <CargandoSkeleton filas={8} />}
      {error && <p className="mt-8 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!cargando && !error && informe && r && (
        <>
          <div className="animate-fade-up mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <div className="col-span-2 lg:row-span-2">
              <HeroVentas
                icono={<IconMoneda />}
                valor={formatPrecio(r.ventas_brutas)}
                periodo={etiqueta}
                delta={calcularDelta(r.ventas_brutas, ra?.ventas_brutas)}
                vs={vs}
                serie={informe.serie_diaria.map((d) => d.total)}
                mejorDia={
                  mejorDia && informe.serie_diaria.length > 1
                    ? `${formatDiaCorto(mejorDia.fecha)} · ${formatPrecio(mejorDia.total)}`
                    : undefined
                }
              />
            </div>
            <TarjetaKpi
              tono="azul"
              icono={<IconPedidosIcon />}
              label="Pedidos"
              valor={String(r.pedidos)}
              delta={calcularDelta(r.pedidos, ra?.pedidos)}
              vs={vs}
              serie={informe.serie_diaria.map((d) => d.pedidos)}
            />
            <TarjetaKpi
              tono="amarillo"
              icono={<IconTicket />}
              label="Ticket promedio"
              valor={formatPrecio(r.ticket_promedio)}
              delta={calcularDelta(r.ticket_promedio, ra?.ticket_promedio)}
              vs={vs}
              serie={informe.serie_diaria.map((d) => (d.pedidos ? d.total / d.pedidos : 0))}
            />
            <TarjetaKpi
              tono="verde"
              icono={<IconArticulos />}
              label="Artículos vendidos"
              valor={String(r.articulos_vendidos)}
              delta={calcularDelta(r.articulos_vendidos, ra?.articulos_vendidos)}
              vs={vs}
            />
            <TarjetaKpi
              tono="naranja"
              icono={<IconTendencia />}
              label="Promedio diario"
              valor={formatPrecio(r.promedio_diario)}
              delta={calcularDelta(r.promedio_diario, ra?.promedio_diario)}
              vs={vs}
            />
            <div className="col-span-2 lg:col-span-4">
              <TiraDomicilio
                icono={<IconMoto />}
                valor={formatPrecio(r.costo_domicilio_total)}
                porcentaje={
                  r.ventas_brutas > 0
                    ? (r.costo_domicilio_total / r.ventas_brutas) * 100
                    : 0
                }
              />
            </div>
          </div>

          <div className="mt-4">
            <Panel
              titulo="Ventas por día"
              subtitulo={etiquetaRango(informe.desde, informe.hasta)}
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

          <div className="mt-3 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            <TarjetaKpi
              tono="verde"
              icono={<IconClienteNuevo />}
              label="Clientes nuevos"
              valor={String(informe.clientes.nuevos)}
              detalle="Primera compra en este período"
              delta={calcularDelta(informe.clientes.nuevos, anterior?.clientes.nuevos)}
              vs={vs}
              serie={informe.clientes.serie_diaria_nuevos.map((d) => d.nuevos)}
            />
            <TarjetaKpi
              tono="azul"
              icono={<IconClienteRecurrente />}
              label="Clientes recurrentes"
              valor={String(informe.clientes.recurrentes)}
              detalle="Ya habían comprado antes"
              delta={calcularDelta(informe.clientes.recurrentes, anterior?.clientes.recurrentes)}
              vs={vs}
            />
            <div className="col-span-2 lg:col-span-1">
              <TarjetaKpi
                tono="amarillo"
                icono={<IconTicket />}
                label="Ticket promedio por cliente"
                valor={formatPrecio(informe.clientes.ticket_promedio)}
                delta={calcularDelta(informe.clientes.ticket_promedio, anterior?.clientes.ticket_promedio)}
                vs={vs}
              />
            </div>
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

export default function InformesPage() {
  return (
    <RequireRol roles={['admin']}>
      <InformesPageInterno />
    </RequireRol>
  );
}
