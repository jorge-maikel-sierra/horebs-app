'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRol } from '@/lib/use-rol';
import { adminFetch } from '@/lib/admin-fetch';
import { formatPrecio, formatHora, formatCantidad, type UnidadMedida } from '@/lib/formato';
import { hoyBogota, sumarDias, formatearFechaCorta } from '@/lib/semana';
import CargandoSkeleton from '@/components/CargandoSkeleton';

// ---- Tipos (subconjuntos de los DTOs reales del backend) ----

type TurnoDto = { id: string; abierto_en: string; estado: 'abierto' | 'cerrado' };
type ResumenVentasDto = {
  total_efectivo: number;
  total_transferencia: number;
  total_tarjeta: number;
  total_ventas: number;
  cantidad_ventas: number;
};
type TurnoActualDto = { turno: TurnoDto | null; resumen: ResumenVentasDto | null };

type PedidoActivo = { id: string; estado: string };

type InsumoBajo = { id: string; nombre: string; unidad_medida: UnidadMedida; stock_actual_g: number; stock_minimo_g: number };

type ConversacionBot = { id: string; estado: 'bot' | 'derivado' };

type InformeResumen = {
  resumen: { ventas_brutas: number; pedidos: number; articulos_vendidos: number; ticket_promedio: number };
  serie_diaria: { fecha: string; total: number }[];
};

type TableroFila = { empleado: { nombre: string }; semana: { neto_pagar: number; estado: 'en_curso' | 'liquidada' } };

type PublicidadResumen = {
  cuenta: { gasto_hoy: number; presupuesto_diario_total: number; roas_hoy: number | null };
  comparacion_hoy: { gasto_meta: number; ventas_reales_hoy: number };
};

const ESTADO_PEDIDO_LABEL: Record<string, string> = {
  pendiente: 'pendiente',
  confirmado: 'confirmado',
  en_preparacion: 'en preparación',
};

// ---- Íconos (24x24, mismo estilo que el resto del panel) ----

function IconPos() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8V6a3 3 0 0 1 6 0v2" />
      <path d="M4 8h10l1 12H3L4 8Z" />
    </svg>
  );
}

function IconPedidos() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h10a1 1 0 0 1 1 1v16l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1Z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  );
}

function IconPedidosGrande() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h10a1 1 0 0 1 1 1v16l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1Z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  );
}

function IconUsuarios() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 8.5a3 3 0 1 1 3.2 3M21 20c0-2.8-1.9-5.1-4.5-5.8" />
    </svg>
  );
}

function IconBlog() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5V5a2 2 0 0 1 2-2h9l5 5v11.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <path d="M14 3v5h5" />
      <path d="M8 13h8M8 17h5" />
    </svg>
  );
}

function IconConfig() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1Z" />
    </svg>
  );
}

function IconAlerta() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" />
    </svg>
  );
}

function IconWhatsapp() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 20l1-5.4A8.5 8.5 0 1 1 21 11.5Z" />
      <path d="M8.5 10.5c.3 2.2 2.3 4.2 4.5 4.5" />
    </svg>
  );
}

function IconReloj() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

function IconMoneda() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.5c0-1.4 1.2-2.2 2.7-2.2 1.6 0 2.8.9 2.8 2 0 3-5.5 1.5-5.5 4.4 0 1.2 1.2 2.1 2.8 2.1 1.5 0 2.7-.8 2.7-2.2" />
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

function IconArticulos() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8 12 3 3 8l9 5 9-5Z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  );
}

function IconNomina() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </svg>
  );
}

function IconMegafono() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11v2a2 2 0 0 0 2 2h1l3 5V4l-3 5H5a2 2 0 0 0-2 2Z" />
      <path d="M14 7a5 5 0 0 1 0 10M18 4a9 9 0 0 1 0 16" />
    </svg>
  );
}

function IconObjetivo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
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

// ---- Componentes de UI (mismo look que apps/web/src/app/admin/informes/page.tsx) ----

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
    <div className="card-gradient min-w-0 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex min-w-0 items-center gap-2 text-brand-orange">
        <span className="shrink-0">
          <Icon />
        </span>
        <span className="truncate text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          {label}
        </span>
      </div>
      <p className="mt-1.5 min-w-0 truncate text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
        {valor}
      </p>
      {detalle && (
        <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{detalle}</p>
      )}
    </div>
  );
}

function TarjetaAlerta({
  icon: Icon,
  label,
  valor,
  detalle,
  href,
  nivel,
}: {
  icon: () => React.ReactElement;
  label: string;
  valor: string;
  detalle?: string;
  href: string;
  nivel: 'alerta' | 'ok';
}) {
  return (
    <Link
      href={href}
      className="card-gradient card-interactive block rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800"
    >
      <div
        className={`flex items-center gap-2 ${
          nivel === 'alerta'
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-green-600 dark:text-green-400'
        }`}
      >
        <Icon />
        <span className="text-xs font-semibold tracking-wide uppercase">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{valor}</p>
      {detalle && (
        <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{detalle}</p>
      )}
    </Link>
  );
}

function Panel({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
      <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">{titulo}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

const ALTURA_GRAFICO_COMPACTO = 60;

function GraficoCompacto({ datos }: { datos: { fecha: string; total: number }[] }) {
  const max = Math.max(1, ...datos.map((d) => d.total));
  return (
    <div className="mt-3 flex items-end gap-1" style={{ height: ALTURA_GRAFICO_COMPACTO }}>
      {datos.map((d) => (
        <div key={d.fecha} className="group relative flex-1">
          <div
            className="w-full rounded-t-sm"
            style={{
              height: Math.max((d.total / max) * ALTURA_GRAFICO_COMPACTO, 3),
              backgroundImage:
                'linear-gradient(180deg, var(--brand-orange), color-mix(in srgb, var(--brand-orange) 55%, var(--brand-yellow)))',
            }}
            title={`${formatearFechaCorta(d.fecha)}: ${formatPrecio(d.total)}`}
          />
        </div>
      ))}
    </div>
  );
}

export default function AdminPage() {
  const { rol } = useRol();

  // ---- Fetches universales (admin y empleado) ----
  const [turno, setTurno] = useState<TurnoActualDto | null>(null);
  const [cargandoTurno, setCargandoTurno] = useState(true);
  const [errorTurno, setErrorTurno] = useState(false);

  const [pedidosActivos, setPedidosActivos] = useState<PedidoActivo[] | null>(null);
  const [cargandoPedidos, setCargandoPedidos] = useState(true);

  const [insumosBajos, setInsumosBajos] = useState<InsumoBajo[] | null>(null);
  const [cargandoInsumos, setCargandoInsumos] = useState(true);

  useEffect(() => {
    adminFetch('/turnos/actual')
      .then(async (res) => {
        if (!res.ok) throw new Error();
        setTurno(await res.json());
      })
      .catch(() => setErrorTurno(true))
      .finally(() => setCargandoTurno(false));
  }, []);

  useEffect(() => {
    adminFetch('/admin/pedidos')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setPedidosActivos(data))
      .finally(() => setCargandoPedidos(false));
  }, []);

  useEffect(() => {
    adminFetch('/inventario/insumos?stockBajo=true')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setInsumosBajos(data))
      .finally(() => setCargandoInsumos(false));
  }, []);

  // ---- Fetches solo-admin (los endpoints devolverían 403 para empleado) ----
  const [conversaciones, setConversaciones] = useState<ConversacionBot[] | null>(null);
  const [cargandoConversaciones, setCargandoConversaciones] = useState(true);

  const [ventasHoy, setVentasHoy] = useState<InformeResumen | null>(null);
  const [cargandoVentasHoy, setCargandoVentasHoy] = useState(true);

  const [ventas7dias, setVentas7dias] = useState<InformeResumen | null>(null);
  const [cargandoVentas7dias, setCargandoVentas7dias] = useState(true);

  const [nomina, setNomina] = useState<TableroFila[] | null>(null);
  const [cargandoNomina, setCargandoNomina] = useState(true);

  const [publicidad, setPublicidad] = useState<PublicidadResumen | null>(null);
  const [publicidadDisponible, setPublicidadDisponible] = useState(true);
  const [cargandoPublicidad, setCargandoPublicidad] = useState(true);

  useEffect(() => {
    if (rol !== 'admin') return;

    adminFetch('/admin/seguimiento/conversaciones')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setConversaciones(data))
      .finally(() => setCargandoConversaciones(false));

    const hoy = hoyBogota();
    adminFetch(`/informes?desde=${hoy}&hasta=${hoy}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setVentasHoy(data))
      .finally(() => setCargandoVentasHoy(false));

    const desde7 = sumarDias(hoy, -6);
    adminFetch(`/informes?desde=${desde7}&hasta=${hoy}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setVentas7dias(data))
      .finally(() => setCargandoVentas7dias(false));

    adminFetch('/nomina/tablero')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setNomina(data))
      .finally(() => setCargandoNomina(false));

    adminFetch('/publicidad/meta-ads')
      .then(async (res) => {
        if (res.status === 404) {
          setPublicidadDisponible(false);
          return;
        }
        if (!res.ok) throw new Error();
        setPublicidad(await res.json());
      })
      .catch(() => setPublicidadDisponible(false))
      .finally(() => setCargandoPublicidad(false));
  }, [rol]);

  // ---- Valores derivados para las tarjetas de alerta ----
  const activos = pedidosActivos?.filter(
    (p) => p.estado !== 'entregado' && p.estado !== 'cancelado',
  );
  const conversacionesEsperando = conversaciones?.filter((c) => c.estado === 'derivado');

  const detallePedidos = activos && activos.length > 0
    ? Object.entries(
        activos.reduce<Record<string, number>>((acc, p) => {
          acc[p.estado] = (acc[p.estado] ?? 0) + 1;
          return acc;
        }, {}),
      )
        .map(([estado, n]) => `${n} ${ESTADO_PEDIDO_LABEL[estado] ?? estado}`)
        .join(' · ')
    : 'Sin pedidos activos';

  const detalleStock = insumosBajos && insumosBajos.length > 0
    ? insumosBajos
        .slice(0, 2)
        .map((i) => i.nombre)
        .join(', ') + (insumosBajos.length > 2 ? ` +${insumosBajos.length - 2} más` : '')
    : 'Todo en orden';

  const nominaEnCurso = nomina?.filter((f) => f.semana.estado === 'en_curso') ?? [];
  const nominaPendiente = nominaEnCurso.reduce((s, f) => s + f.semana.neto_pagar, 0);
  const nominaLiquidadas = nomina?.filter((f) => f.semana.estado === 'liquidada').length ?? 0;

  return (
    <div className="p-8">
      <h1 className="animate-fade-up text-2xl font-bold text-zinc-900 sm:text-3xl dark:text-zinc-50">
        Hola 👋
      </h1>
      <p className="animate-fade-up delay-1 mt-1 text-zinc-600 dark:text-zinc-400">
        Resumen del negocio — sesión de <span className="capitalize">{rol ?? '…'}</span>.
      </p>

      {/* Atención requerida */}
      <div className="animate-fade-up delay-2 mt-6">
        <p className="text-xs font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
          Atención requerida
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <TarjetaAlerta
            icon={IconPedidosGrande}
            label="Pedidos activos"
            valor={cargandoPedidos ? '…' : String(activos?.length ?? '—')}
            detalle={cargandoPedidos ? undefined : detallePedidos}
            href="/admin/pedidos"
            nivel={activos && activos.length > 0 ? 'alerta' : 'ok'}
          />
          <TarjetaAlerta
            icon={IconAlerta}
            label="Stock bajo"
            valor={cargandoInsumos ? '…' : String(insumosBajos?.length ?? '—')}
            detalle={cargandoInsumos ? undefined : detalleStock}
            href="/admin/inventario"
            nivel={insumosBajos && insumosBajos.length > 0 ? 'alerta' : 'ok'}
          />
          {rol === 'admin' && (
            <TarjetaAlerta
              icon={IconWhatsapp}
              label="WhatsApp esperando"
              valor={cargandoConversaciones ? '…' : String(conversacionesEsperando?.length ?? '—')}
              detalle="Conversaciones derivadas a una persona"
              href="/admin/seguimiento"
              nivel={conversacionesEsperando && conversacionesEsperando.length > 0 ? 'alerta' : 'ok'}
            />
          )}
        </div>
      </div>

      {/* Turno actual */}
      <div className="animate-fade-up delay-2 mt-6">
        <Panel titulo="Turno actual">
          {cargandoTurno ? (
            <CargandoSkeleton filas={1} />
          ) : errorTurno ? (
            <p className="text-sm text-red-600 dark:text-red-400">No se pudo cargar el turno.</p>
          ) : !turno?.turno ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                <IconReloj /> No hay un turno abierto ahora mismo.
              </p>
              <Link href="/admin/pos" className="text-sm font-semibold text-brand-orange hover:underline">
                Abrir turno →
              </Link>
            </div>
          ) : (
            <div>
              <p className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <IconReloj /> Abierto desde {formatHora(turno.turno.abierto_en)}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-4">
                <div className="min-w-0">
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">Ventas</p>
                  <p className="truncate font-bold text-zinc-900 dark:text-zinc-50">
                    {formatPrecio(turno.resumen?.total_ventas ?? 0)}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">Efectivo</p>
                  <p className="truncate font-semibold text-zinc-700 dark:text-zinc-300">
                    {formatPrecio(turno.resumen?.total_efectivo ?? 0)}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">Transferencia</p>
                  <p className="truncate font-semibold text-zinc-700 dark:text-zinc-300">
                    {formatPrecio(turno.resumen?.total_transferencia ?? 0)}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">Tarjeta</p>
                  <p className="truncate font-semibold text-zinc-700 dark:text-zinc-300">
                    {formatPrecio(turno.resumen?.total_tarjeta ?? 0)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </Panel>
      </div>

      {rol === 'admin' && (
        <>
          {/* Ventas */}
          <div className="animate-fade-up delay-3 mt-6">
            <Panel titulo="Ventas">
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
                    Hoy
                  </p>
                  {cargandoVentasHoy ? (
                    <CargandoSkeleton filas={2} />
                  ) : ventasHoy ? (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <TarjetaMetrica icon={IconMoneda} label="Ventas" valor={formatPrecio(ventasHoy.resumen.ventas_brutas)} />
                      <TarjetaMetrica icon={IconPedidos} label="Pedidos" valor={String(ventasHoy.resumen.pedidos)} />
                      <TarjetaMetrica icon={IconTicket} label="Ticket prom." valor={formatPrecio(ventasHoy.resumen.ticket_promedio)} />
                      <TarjetaMetrica icon={IconArticulos} label="Artículos" valor={String(ventasHoy.resumen.articulos_vendidos)} />
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Sin datos.</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
                    Últimos 7 días
                  </p>
                  {cargandoVentas7dias ? (
                    <CargandoSkeleton filas={2} />
                  ) : ventas7dias ? (
                    <>
                      <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                        {formatPrecio(ventas7dias.resumen.ventas_brutas)}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{ventas7dias.resumen.pedidos} pedidos</p>
                      <GraficoCompacto datos={ventas7dias.serie_diaria} />
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Sin datos.</p>
                  )}
                </div>
              </div>
              <Link href="/admin/informes" className="mt-4 inline-block text-sm font-semibold text-brand-orange hover:underline">
                Ver informes completos →
              </Link>
            </Panel>
          </div>

          {/* Nómina + Publicidad */}
          <div className="animate-fade-up delay-3 mt-6 grid gap-6 lg:grid-cols-2">
            <Panel titulo="Nómina de la semana">
              {cargandoNomina ? (
                <CargandoSkeleton filas={2} />
              ) : !nomina || nomina.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No hay trabajadores activos registrados.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <TarjetaMetrica
                    icon={IconNomina}
                    label="Pendiente"
                    valor={formatPrecio(nominaPendiente)}
                    detalle={`${nominaEnCurso.length} en curso`}
                  />
                  <TarjetaMetrica icon={IconCheck} label="Liquidadas" valor={String(nominaLiquidadas)} />
                </div>
              )}
              <Link href="/admin/nomina" className="mt-4 inline-block text-sm font-semibold text-brand-orange hover:underline">
                Ver nómina →
              </Link>
            </Panel>

            <Panel titulo="Publicidad (Meta Ads) — hoy">
              {cargandoPublicidad ? (
                <CargandoSkeleton filas={2} />
              ) : !publicidadDisponible ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Todavía no hay datos de Meta Ads capturados.
                </p>
              ) : publicidad ? (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <TarjetaMetrica icon={IconMegafono} label="Gasto hoy" valor={formatPrecio(publicidad.cuenta.gasto_hoy)} />
                    <TarjetaMetrica
                      icon={IconObjetivo}
                      label="Presupuesto"
                      valor={formatPrecio(publicidad.cuenta.presupuesto_diario_total)}
                    />
                    <TarjetaMetrica
                      icon={IconTendencia}
                      label="ROAS"
                      valor={publicidad.cuenta.roas_hoy != null ? `${publicidad.cuenta.roas_hoy.toFixed(2)}x` : '—'}
                    />
                  </div>
                  <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                    Gasto {formatPrecio(publicidad.comparacion_hoy.gasto_meta)} vs. ventas reales{' '}
                    {formatPrecio(publicidad.comparacion_hoy.ventas_reales_hoy)}
                  </p>
                </>
              ) : null}
              <Link href="/admin/informes" className="mt-4 inline-block text-sm font-semibold text-brand-orange hover:underline">
                Ver publicidad completa →
              </Link>
            </Panel>
          </div>
        </>
      )}

      {/* Accesos rápidos */}
      <h2 className="animate-fade-up delay-3 mt-8 text-lg font-bold text-zinc-900 dark:text-zinc-50">
        Accesos rápidos
      </h2>
      <div className="animate-fade-up delay-3 mt-3 grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/pos"
          className="card-interactive btn-gradient flex flex-col gap-3 rounded-2xl p-6 text-white shadow-sm"
        >
          <IconPos />
          <div>
            <p className="text-lg font-bold">Punto de venta</p>
            <p className="mt-0.5 text-sm text-white/85">
              Registrar una venta directo del local
            </p>
          </div>
        </Link>
        <Link
          href="/admin/pedidos"
          className="card-interactive flex flex-col gap-3 rounded-2xl border border-zinc-200 p-6 text-zinc-900 shadow-sm dark:border-zinc-800 dark:text-zinc-50"
          style={{
            backgroundImage:
              'linear-gradient(165deg, color-mix(in srgb, var(--brand-navy) 14%, var(--background)) 0%, var(--background) 55%, color-mix(in srgb, var(--brand-navy) 8%, var(--background)) 100%)',
          }}
        >
          <span className="text-brand-navy dark:text-blue-300">
            <IconPedidosGrande />
          </span>
          <div>
            <p className="text-lg font-bold">Pedidos</p>
            <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
              Ver y gestionar los pedidos que van llegando
            </p>
          </div>
        </Link>
      </div>

      {rol === 'admin' && (
        <div className="animate-fade-up delay-3 mt-6">
          <p className="text-xs font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
            Administración
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Link
              href="/admin/usuarios"
              className="card-interactive card-gradient flex items-center gap-3 rounded-xl border border-zinc-200 p-4 text-zinc-900 dark:border-zinc-800 dark:text-zinc-50"
            >
              <span className="text-brand-orange">
                <IconUsuarios />
              </span>
              <span className="text-sm font-semibold">Usuarios</span>
            </Link>
            <Link
              href="/admin/blog"
              className="card-interactive card-gradient flex items-center gap-3 rounded-xl border border-zinc-200 p-4 text-zinc-900 dark:border-zinc-800 dark:text-zinc-50"
            >
              <span className="text-brand-orange">
                <IconBlog />
              </span>
              <span className="text-sm font-semibold">Blog</span>
            </Link>
            <Link
              href="/admin/configuracion"
              className="card-interactive card-gradient flex items-center gap-3 rounded-xl border border-zinc-200 p-4 text-zinc-900 dark:border-zinc-800 dark:text-zinc-50"
            >
              <span className="text-brand-orange">
                <IconConfig />
              </span>
              <span className="text-sm font-semibold">Configuración</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
