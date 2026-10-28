'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { adminFetch } from '@/lib/admin-fetch';
import { formatPrecio } from '@/lib/formato';
import { useRol } from '@/lib/use-rol';
import { useAviso } from '@/lib/use-aviso';
import AvisoFlotante from '@/components/AvisoFlotante';
import CargandoSkeleton from '@/components/CargandoSkeleton';
import ModalBase from '@/components/ModalBase';
import ModalConfirmar from '@/components/ModalConfirmar';
import BuscadorPedidos from '@/components/pedidos/BuscadorPedidos';
import ModalEditarCliente from '@/components/pedidos/ModalEditarCliente';
import MenuPedido from '@/components/pedidos/MenuPedido';
import ModalEditarPedido from '@/components/pedidos/ModalEditarPedido';
import Resaltado from '@/components/pedidos/Resaltado';
import {
  etiquetaItem,
  nombreDelCliente,
  type Categoria,
  type ClientePedido,
  type PedidoAdmin,
  type Producto,
} from '@/components/pedidos/tipos';
import { useDebounced } from '@/lib/use-debounced';
import { hoyBogota } from '@/lib/semana';
import {
  CANAL_LABEL,
  FILTROS_INICIALES,
  MODALIDAD_LABEL,
  buscarPedidos,
  coincidenciasOcultas,
  terminosParaResaltar,
  type FiltrosPedidos,
} from '@/lib/pedidos-busqueda';

/** "2026-10-28T18:30:00-05:00" → "6:30 p. m." en hora de Bogotá. */
function horaReserva(iso: string) {
  return new Intl.DateTimeFormat('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  }).format(new Date(iso));
}

function formatFecha(iso: string) {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(new Date(iso));
}

function Icono({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const IconLapiz = () => (
  <Icono>
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </Icono>
);
const IconPedido = () => (
  <Icono>
    <path d="M9 11H4l1.5-4.5A2 2 0 0 1 7.4 5h9.2a2 2 0 0 1 1.9 1.5L20 11h-5" />
    <path d="M4 11v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
    <path d="M9 11v3a3 3 0 0 0 6 0v-3" />
  </Icono>
);
const IconBasura = () => (
  <Icono>
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
  </Icono>
);
const IconDescargar = () => (
  <Icono>
    <path d="M12 3v12m0 0-4-4m4 4 4-4" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </Icono>
);

const IconOjo = () => (
  <Icono>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Icono>
);

const ACCION =
  'btn-press flex h-10 w-10 items-center justify-center rounded-xl border border-brand-orange/40 text-accent-ink outline-none transition-colors hover:border-brand-orange hover:bg-brand-orange/10 focus-visible:ring-2 focus-visible:ring-brand-orange/60 disabled:opacity-40';
const ETIQUETA =
  'mt-3.5 text-[10px] font-semibold tracking-[0.14em] text-zinc-400 uppercase dark:text-zinc-500';
const CHIP =
  'mt-1 inline-block max-w-full truncate rounded-lg bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200';

const IconSiguiente = () => (
  <Icono>
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </Icono>
);
const IconCancelar = () => (
  <Icono>
    <circle cx="12" cy="12" r="9" />
    <path d="m15 9-6 6M9 9l6 6" />
  </Icono>
);

/**
 * Próximo paso del pedido. En camino solo aplica a domicilio. Los pedidos
 * del bot de WhatsApp le avisan al cliente en cada cambio.
 */
function siguienteEstado(
  p: Pick<PedidoAdmin, 'estado' | 'modalidad'>,
): { estado: string; texto: string } | null {
  switch (p.estado) {
    case 'pendiente':
      return { estado: 'confirmado', texto: 'Confirmar pedido' };
    case 'confirmado':
      return { estado: 'en_preparacion', texto: 'Pasar al horno' };
    case 'en_preparacion':
      return p.modalidad === 'domicilio'
        ? { estado: 'en_camino', texto: 'Salió a domicilio' }
        : { estado: 'entregado', texto: 'Marcar entregado' };
    case 'en_camino':
      return { estado: 'entregado', texto: 'Marcar entregado' };
    default:
      return null;
  }
}

function tonoEstado(estado: string) {
  if (estado === 'en_camino')
    return 'bg-sky-500/10 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300';
  if (estado === 'entregado')
    return 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300';
  if (estado === 'cancelado')
    return 'bg-red-500/10 text-red-700 dark:bg-red-400/10 dark:text-red-300';
  return 'bg-brand-yellow/20 text-brand-yellow-800 dark:bg-brand-yellow/15 dark:text-brand-yellow-300';
}

function PedidosInterno() {
  const { rol } = useRol();
  const { aviso, mostrar } = useAviso();
  const [pedidos, setPedidos] = useState<PedidoAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<FiltrosPedidos>(FILTROS_INICIALES);
  const [hoy] = useState(hoyBogota);

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productosCatalogo, setProductosCatalogo] = useState<Producto[]>([]);

  const [clienteEnEdicion, setClienteEnEdicion] =
    useState<ClientePedido | null>(null);
  const [pedidoEnEdicion, setPedidoEnEdicion] = useState<PedidoAdmin | null>(
    null,
  );
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [pedidoAEliminar, setPedidoAEliminar] = useState<PedidoAdmin | null>(
    null,
  );
  const [eliminando, setEliminando] = useState(false);
  const [descargandoId, setDescargandoId] = useState<string | null>(null);
  const [abriendoComprobanteId, setAbriendoComprobanteId] = useState<
    string | null
  >(null);
  const [cambiandoEstadoId, setCambiandoEstadoId] = useState<string | null>(
    null,
  );
  const [pedidoACancelar, setPedidoACancelar] = useState<PedidoAdmin | null>(
    null,
  );

  useEffect(() => {
    adminFetch('/admin/pedidos')
      .then(async (res) => {
        if (!res.ok) throw new Error('No se pudieron cargar los pedidos.');
        setPedidos(await res.json());
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Error desconocido.'),
      )
      .finally(() => setCargando(false));

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
    Promise.all([
      fetch(`${apiUrl}/catalogo/categorias`).then((r) => r.json()),
      fetch(`${apiUrl}/catalogo/productos`).then((r) => r.json()),
    ])
      .then(([cats, prods]) => {
        setCategorias(cats);
        setProductosCatalogo(prods);
      })
      .catch(() => undefined);
  }, []);

  function clienteGuardado(actualizado: ClientePedido) {
    // El cliente es un registro compartido: se refleja en todos sus pedidos de la lista.
    setPedidos((prev) =>
      prev.map((p) =>
        p.cliente.id === actualizado.id
          ? { ...p, cliente: { ...p.cliente, ...actualizado } }
          : p,
      ),
    );
    setClienteEnEdicion(null);
    mostrar('Cliente actualizado');
  }

  function pedidoGuardado(actualizado: PedidoAdmin) {
    setPedidos((prev) =>
      prev.map((p) => (p.id === actualizado.id ? actualizado : p)),
    );
    setPedidoEnEdicion(null);
    mostrar('Pedido actualizado');
  }

  async function confirmarEliminarPedido() {
    const p = pedidoAEliminar;
    if (!p) return;
    setEliminando(true);
    try {
      const res = await adminFetch(`/admin/pedidos/${p.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          typeof body?.message === 'string'
            ? body.message
            : 'No se pudo eliminar el pedido.',
        );
      }
      setPedidos((prev) => prev.filter((x) => x.id !== p.id));
      mostrar('Pedido eliminado');
    } catch (err) {
      mostrar(
        err instanceof Error ? err.message : 'No se pudo eliminar el pedido.',
        true,
      );
    } finally {
      setEliminando(false);
      setPedidoAEliminar(null);
    }
  }

  async function cambiarEstado(p: PedidoAdmin, estado: string) {
    setCambiandoEstadoId(p.id);
    try {
      const res = await adminFetch(`/admin/pedidos/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ estado }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          typeof body?.message === 'string'
            ? body.message
            : 'No se pudo cambiar el estado.',
        );
      }
      const actualizado: PedidoAdmin = await res.json();
      setPedidos((prev) =>
        prev.map((x) => (x.id === actualizado.id ? actualizado : x)),
      );
      mostrar(
        p.canal === 'whatsapp'
          ? 'Estado actualizado — se le avisó al cliente por WhatsApp'
          : 'Estado actualizado',
      );
    } catch (err) {
      mostrar(
        err instanceof Error ? err.message : 'No se pudo cambiar el estado.',
        true,
      );
    } finally {
      setCambiandoEstadoId(null);
      setPedidoACancelar(null);
    }
  }

  async function verComprobante(p: PedidoAdmin) {
    setAbriendoComprobanteId(p.id);
    // La pestaña se abre antes del await: si no, el navegador la bloquea
    // como popup por no venir directo del clic.
    const ventana = window.open('', '_blank');
    try {
      const res = await adminFetch(`/admin/pedidos/${p.id}/comprobante`);
      if (!res.ok) throw new Error('No se pudo abrir el comprobante.');
      const { url } = (await res.json()) as { url: string };
      // Si el navegador bloqueó la pestaña, se abre en la misma.
      if (ventana) ventana.location.href = url;
      else window.location.assign(url);
    } catch (err) {
      ventana?.close();
      mostrar(
        err instanceof Error ? err.message : 'No se pudo abrir el comprobante.',
        true,
      );
    } finally {
      setAbriendoComprobanteId(null);
    }
  }

  async function descargarFactura(p: PedidoAdmin) {
    setDescargandoId(p.id);
    try {
      const res = await adminFetch(`/admin/pedidos/${p.id}/factura`);
      if (!res.ok) throw new Error('No se pudo generar el comprobante.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `comprobante-${p.id.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      mostrar(
        err instanceof Error
          ? err.message
          : 'No se pudo descargar el comprobante.',
        true,
      );
    } finally {
      setDescargandoId(null);
    }
  }

  const pedidoDetalle = pedidos.find((p) => p.id === detalleId) ?? null;

  const imagenPorProducto = useMemo(
    () =>
      new Map(
        productosCatalogo.flatMap((p) =>
          p.imagen_url ? [[p.nombre, p.imagen_url] as const] : [],
        ),
      ),
    [productosCatalogo],
  );

  // El texto se aplica con un pequeño debounce: la lista no se recalcula ni se
  // vuelve a animar en cada tecla.
  const aplicados = useDebounced(filtros, 180);
  const { resultados: pedidosFiltrados, terminos } = useMemo(
    () => buscarPedidos(pedidos, aplicados, hoy),
    [pedidos, aplicados, hoy],
  );
  const resaltar = terminosParaResaltar(terminos);
  const firmaBusqueda = JSON.stringify(aplicados);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          Pedidos
        </h1>
        <Link
          href="/admin/pos"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-accent-ink dark:border-zinc-700 dark:text-zinc-300"
        >
          Volver al POS
        </Link>
      </div>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Últimos {pedidos.length} pedidos, web y del local.
      </p>

      {!cargando && pedidos.length > 0 && (
        <BuscadorPedidos
          pedidos={pedidos}
          filtros={filtros}
          hoy={hoy}
          mostrados={pedidosFiltrados.length}
          onCambiar={(parcial) => setFiltros((f) => ({ ...f, ...parcial }))}
          onLimpiar={() => setFiltros(FILTROS_INICIALES)}
        />
      )}

      {cargando && <CargandoSkeleton filas={5} />}
      {error && (
        <p className="mt-6 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {!cargando && !error && pedidos.length === 0 && (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          Todavía no hay pedidos registrados.
        </p>
      )}

      {!cargando &&
        !error &&
        pedidos.length > 0 &&
        pedidosFiltrados.length === 0 && (
          <div className="animate-fade-up card-gradient mt-6 flex flex-col items-center rounded-3xl border border-dashed border-zinc-300 px-6 py-14 text-center dark:border-zinc-700">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-orange/15 text-accent-ink">
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5M8.5 11h5" />
              </svg>
            </span>
            <p className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Ningún pedido coincide
            </p>
            <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
              {filtros.texto.trim()
                ? `No encontramos pedidos para “${filtros.texto.trim()}” con los filtros actuales.`
                : 'No hay pedidos con los filtros actuales.'}{' '}
              Revisa la ortografía o prueba con menos palabras.
            </p>
            <button
              type="button"
              onClick={() => setFiltros(FILTROS_INICIALES)}
              className="btn-gradient btn-press mt-5 h-11 rounded-xl px-5 text-sm font-semibold text-white shadow-md shadow-brand-orange/25 outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
            >
              Limpiar filtros
            </button>
          </div>
        )}

      <div
        key={firmaBusqueda}
        className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        {pedidosFiltrados.map((p, indice) => {
          const nombreCompleto = nombreDelCliente(p.cliente);
          const siguiente = siguienteEstado(p);
          // El ítem más caro (la pizza, no la gaseosa) va como foto principal.
          const fotos = [
            ...new Set(
              [...p.items]
                .sort((x, y) => y.precio_unitario - x.precio_unitario)
                .flatMap((i) => {
                  const url = imagenPorProducto.get(i.producto_nombre);
                  return url ? [url] : [];
                }),
            ),
          ];
          return (
            <article
              key={p.id}
              style={{ '--i': Math.min(indice, 8) } as CSSProperties}
              className="resultado-item group flex flex-col rounded-3xl border border-zinc-200 bg-white p-3 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.45)] transition-shadow duration-300 hover:shadow-[0_26px_50px_-24px_rgba(0,0,0,0.55)] dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between gap-2 pl-1.5">
                <p className="min-w-0 truncate text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                  Código{' '}
                  <span className="font-mono text-zinc-800 dark:text-zinc-200">
                    #<Resaltado texto={p.id.slice(0, 8)} terminos={resaltar} />
                  </span>
                </p>
                <MenuPedido
                  etiqueta={`Más acciones del pedido #${p.id.slice(0, 8)}`}
                  opciones={[
                    {
                      etiqueta: 'Editar cliente',
                      icono: <IconLapiz />,
                      deshabilitada: !p.cliente.id,
                      titulo: !p.cliente.id
                        ? 'El cliente de este pedido fue eliminado'
                        : undefined,
                      onSelect: () => setClienteEnEdicion(p.cliente),
                    },
                    ...(siguienteEstado(p)
                      ? [
                          {
                            etiqueta: 'Cancelar pedido',
                            icono: <IconCancelar />,
                            peligro: true,
                            onSelect: () => setPedidoACancelar(p),
                          },
                        ]
                      : []),
                    ...(rol === 'admin'
                      ? [
                          {
                            etiqueta: 'Eliminar pedido',
                            icono: <IconBasura />,
                            peligro: true,
                            onSelect: () => setPedidoAEliminar(p),
                          },
                        ]
                      : []),
                  ]}
                />
              </div>

              <div className="relative mt-2 h-36 overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800">
                {fotos[0] ? (
                  <Image
                    src={fotos[0]}
                    alt=""
                    fill
                    sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 100vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                ) : (
                  <div className="card-gradient-featured absolute inset-0" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/0 to-black/25" />

                <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm ${
                      p.canal === 'pos'
                        ? 'bg-brand-navy'
                        : p.canal === 'whatsapp'
                          ? 'bg-emerald-700'
                          : 'bg-brand-orange-700'
                    }`}
                  >
                    {CANAL_LABEL[p.canal] ?? p.canal}
                  </span>
                  {p.stock_status === 'pendiente' && (
                    <span
                      title="El descuento automático de stock falló para este pedido — revisar el inventario a mano."
                      className="rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm"
                    >
                      ⚠️ Stock
                    </span>
                  )}
                </div>

                {fotos.length > 1 && (
                  <div className="absolute right-2.5 bottom-2.5 flex -space-x-2.5">
                    {fotos.slice(1, 4).map((url) => (
                      <span
                        key={url}
                        className="relative h-8 w-8 overflow-hidden rounded-full shadow-md ring-2 ring-white/90"
                      >
                        <Image src={url} alt="" fill sizes="32px" className="object-cover" />
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col px-1.5 pt-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg leading-tight font-bold text-zinc-900 dark:text-zinc-50">
                      <Resaltado texto={nombreCompleto} terminos={resaltar} />
                    </h2>
                    <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {p.cliente.telefono ? (
                        <Resaltado texto={p.cliente.telefono} terminos={resaltar} />
                      ) : (
                        'Sin teléfono'
                      )}{' '}
                      · {formatFecha(p.created_at)}
                    </p>
                  </div>
                  <span
                    className={`mt-0.5 flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${tonoEstado(p.estado)}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {p.estado.replaceAll('_', ' ')}
                  </span>
                </div>

                <p className={ETIQUETA}>Productos</p>
                <ul className="mt-1 flex-1 space-y-0.5 text-[13px] text-zinc-600 dark:text-zinc-300">
                  {p.items.slice(0, 3).map((i, idx) => (
                    <li key={i.variante_id ?? idx} className="truncate">
                      <span className="font-semibold text-zinc-900 tabular-nums dark:text-zinc-50">
                        {i.cantidad}×
                      </span>{' '}
                      <Resaltado texto={etiquetaItem(i)} terminos={resaltar} />
                    </li>
                  ))}
                  {p.items.length > 3 && (
                    <li className="text-zinc-400 dark:text-zinc-500">
                      +{p.items.length - 3} más
                    </li>
                  )}
                </ul>

                {coincidenciasOcultas(p, terminos).map((c) => (
                  <p
                    key={`${c.campo}-${c.texto}`}
                    className="mt-2 flex items-start gap-1 rounded-lg bg-brand-orange/10 px-2 py-1 text-[11px] text-zinc-700 dark:text-zinc-300"
                  >
                    <span className="shrink-0 font-semibold">{c.campo}:</span>
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      <Resaltado texto={c.texto} terminos={resaltar} />
                    </span>
                  </p>
                ))}

                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <p className={ETIQUETA}>Entrega</p>
                    <span className={CHIP}>
                      {MODALIDAD_LABEL[p.modalidad] ?? p.modalidad}
                    </span>
                    {p.programado_para && (
                      <span
                        className="mt-1 ml-1 inline-block rounded-lg bg-sky-500/10 px-2 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-400/10 dark:text-sky-300"
                        title="Pedido reservado por WhatsApp para esta hora"
                      >
                        🕒 Reserva {horaReserva(p.programado_para)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={ETIQUETA}>Pago</p>
                    <span className={`${CHIP} capitalize`}>{p.metodo_pago}</span>
                    {p.tiene_comprobante && (
                      <button
                        type="button"
                        onClick={() => verComprobante(p)}
                        disabled={abriendoComprobanteId === p.id}
                        className="btn-press mt-1 ml-1 inline-block rounded-lg bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-700 outline-none hover:bg-emerald-500/20 focus-visible:ring-2 focus-visible:ring-emerald-600/60 disabled:opacity-60 dark:bg-emerald-400/10 dark:text-emerald-300"
                      >
                        💸 Comprobante
                        <span className="sr-only">
                          {' '}
                          del pedido #{p.id.slice(0, 8)}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-2xl font-extrabold tracking-tight text-zinc-900 tabular-nums dark:text-zinc-50">
                      {formatPrecio(p.total)}
                    </p>
                    {p.costo_domicilio > 0 && (
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        incl. {formatPrecio(p.costo_domicilio)} domicilio
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => setDetalleId(p.id)}
                      title="Ver detalle"
                      className={ACCION}
                    >
                      <IconOjo />
                      <span className="sr-only">
                        Ver detalle del pedido #{p.id.slice(0, 8)}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={descargandoId === p.id}
                      onClick={() => descargarFactura(p)}
                      title="Descargar comprobante"
                      className={ACCION}
                    >
                      <IconDescargar />
                      <span className="sr-only">
                        Descargar comprobante del pedido #{p.id.slice(0, 8)}
                      </span>
                    </button>
                  </div>
                </div>

                {siguiente && (
                  <button
                    type="button"
                    disabled={cambiandoEstadoId === p.id}
                    onClick={() => cambiarEstado(p, siguiente.estado)}
                    className="btn-press mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 text-[13px] font-bold tracking-[0.1em] text-white uppercase shadow-md shadow-emerald-700/25 outline-none hover:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-600/60 focus-visible:ring-offset-2 disabled:opacity-60 dark:focus-visible:ring-offset-zinc-900"
                  >
                    {cambiandoEstadoId === p.id ? 'Guardando…' : siguiente.texto}
                    {cambiandoEstadoId !== p.id && <IconSiguiente />}
                    <span className="sr-only"> #{p.id.slice(0, 8)}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setPedidoEnEdicion(p)}
                  className="btn-gradient btn-press mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-bold tracking-[0.1em] text-white uppercase shadow-md shadow-brand-orange/25 outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                >
                  <IconPedido />
                  Editar pedido
                  <span className="sr-only"> #{p.id.slice(0, 8)}</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {pedidoDetalle && (
        <ModalBase
          titulo={nombreDelCliente(pedidoDetalle.cliente)}
          subtitulo={`#${pedidoDetalle.id.slice(0, 8)} · ${formatFecha(pedidoDetalle.created_at)}`}
          ancho="sm"
          onCerrar={() => setDetalleId(null)}
        >
          <span className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Productos
          </span>
          <ul className="mt-1 space-y-0.5 text-sm text-zinc-600 dark:text-zinc-400">
            {pedidoDetalle.items.map((i, idx) => (
              <li
                key={i.variante_id ?? idx}
                className="flex justify-between gap-3"
              >
                <span>
                  {i.cantidad}× {etiquetaItem(i)}
                </span>
                <span className="shrink-0 tabular-nums text-zinc-500 dark:text-zinc-400">
                  {formatPrecio(i.precio_unitario * i.cantidad)}
                </span>
              </li>
            ))}
          </ul>
          {pedidoDetalle.direccion_entrega && (
            <p className="mt-3 border-t border-zinc-100 pt-2 text-xs text-zinc-500 dark:border-zinc-800/60 dark:text-zinc-400">
              Entrega: {pedidoDetalle.direccion_entrega}
            </p>
          )}
          <p className="mt-3 border-t border-zinc-100 pt-2 text-right text-lg font-bold tabular-nums text-accent-ink dark:border-zinc-800/60">
            {formatPrecio(pedidoDetalle.total)}
          </p>
        </ModalBase>
      )}

      {clienteEnEdicion && (
        <ModalEditarCliente
          key={clienteEnEdicion.id}
          cliente={clienteEnEdicion}
          otrosPedidos={
            pedidos.filter((p) => p.cliente.id === clienteEnEdicion.id).length
          }
          onCerrar={() => setClienteEnEdicion(null)}
          onGuardado={clienteGuardado}
        />
      )}

      {pedidoEnEdicion && (
        <ModalEditarPedido
          key={pedidoEnEdicion.id}
          pedido={pedidoEnEdicion}
          categorias={categorias}
          productos={productosCatalogo}
          onCerrar={() => setPedidoEnEdicion(null)}
          onGuardado={pedidoGuardado}
        />
      )}

      {pedidoAEliminar && (
        <ModalConfirmar
          titulo="¿Eliminar este pedido?"
          descripcion={
            <>
              Pedido de{' '}
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {pedidoAEliminar.cliente.nombre
                  ? nombreDelCliente(pedidoAEliminar.cliente)
                  : 'cliente sin nombre'}
              </span>{' '}
              por {formatPrecio(pedidoAEliminar.total)}. Esta acción no se puede
              deshacer.
            </>
          }
          textoConfirmar="Eliminar"
          peligro
          cargando={eliminando}
          onConfirmar={confirmarEliminarPedido}
          onCancelar={() => setPedidoAEliminar(null)}
        />
      )}

      {pedidoACancelar && (
        <ModalConfirmar
          titulo="¿Cancelar este pedido?"
          descripcion={
            <>
              Pedido de{' '}
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {pedidoACancelar.cliente.nombre
                  ? nombreDelCliente(pedidoACancelar.cliente)
                  : 'cliente sin nombre'}
              </span>{' '}
              por {formatPrecio(pedidoACancelar.total)}. El stock vuelve al
              inventario
              {pedidoACancelar.canal === 'whatsapp'
                ? ' y al cliente le llega el aviso por WhatsApp'
                : ''}
              .
            </>
          }
          textoConfirmar="Cancelar pedido"
          textoCancelar="Volver"
          peligro
          cargando={cambiandoEstadoId === pedidoACancelar.id}
          onConfirmar={() => cambiarEstado(pedidoACancelar, 'cancelado')}
          onCancelar={() => setPedidoACancelar(null)}
        />
      )}

      <AvisoFlotante aviso={aviso} />
    </div>
  );
}

export default function PedidosPage() {
  return <PedidosInterno />;
}
