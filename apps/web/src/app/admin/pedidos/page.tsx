'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
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
  FILTROS_INICIALES,
  MODALIDAD_LABEL,
  buscarPedidos,
  coincidenciasOcultas,
  terminosParaResaltar,
  type FiltrosPedidos,
} from '@/lib/pedidos-busqueda';

function formatFecha(iso: string) {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(new Date(iso));
}

function IconChevron({ abierto }: { abierto: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
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

const ACCION =
  'btn-press flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 outline-none transition-colors hover:bg-zinc-100 hover:text-brand-orange-700 focus-visible:ring-2 focus-visible:ring-brand-orange/60 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-brand-orange';

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
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-brand-orange dark:border-zinc-700 dark:text-zinc-300"
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
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-orange/15 text-brand-orange-700 dark:text-brand-orange">
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
          return (
            <div
              key={p.id}
              style={{ '--i': Math.min(indice, 8) } as CSSProperties}
              className="resultado-item flex flex-col rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold text-white ${
                      p.canal === 'pos' ? 'bg-brand-navy' : 'bg-brand-orange'
                    }`}
                  >
                    {p.canal === 'pos' ? 'Local' : 'Web'}
                  </span>
                  <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    #<Resaltado texto={p.id.slice(0, 8)} terminos={resaltar} />
                  </span>
                  {p.stock_status === 'pendiente' && (
                    <span
                      title="El descuento automático de stock falló para este pedido — revisar el inventario a mano."
                      className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white"
                    >
                      ⚠️ Stock
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setDetalleId(p.id)}
                  aria-label="Ver detalle del pedido"
                  className="btn-press -mt-1 -mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 outline-none hover:bg-zinc-100 hover:text-zinc-700 focus-visible:ring-2 focus-visible:ring-brand-orange/60 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                  <IconChevron abierto={detalleId === p.id} />
                </button>
              </div>

              <div className="mt-2.5">
                <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">
                  <Resaltado texto={nombreCompleto} terminos={resaltar} />
                </p>
                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {p.cliente.telefono ? (
                    <Resaltado texto={p.cliente.telefono} terminos={resaltar} />
                  ) : (
                    'Sin teléfono'
                  )}{' '}
                  · {formatFecha(p.created_at)}
                </p>
              </div>

              <ul className="mt-2.5 flex-1 space-y-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                {p.items.slice(0, 3).map((i, idx) => (
                  <li key={i.variante_id ?? idx} className="truncate">
                    {i.cantidad}×{' '}
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

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-2.5 text-xs dark:border-zinc-800/60">
                <div className="flex flex-wrap items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                  <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
                    {MODALIDAD_LABEL[p.modalidad] ?? p.modalidad}
                  </span>
                  <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 capitalize dark:bg-zinc-800">
                    {p.metodo_pago}
                  </span>
                  <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 capitalize dark:bg-zinc-800">
                    {p.estado.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-right">
                  <p className="font-bold text-brand-orange-700 dark:text-brand-orange">
                    {formatPrecio(p.total)}
                  </p>
                  {p.costo_domicilio > 0 && (
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      incl. {formatPrecio(p.costo_domicilio)} domicilio
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-2.5 flex items-center gap-0.5 border-t border-zinc-100 pt-2 dark:border-zinc-800/60">
                <button
                  type="button"
                  disabled={!p.cliente.id}
                  onClick={() => setClienteEnEdicion(p.cliente)}
                  title={
                    !p.cliente.id
                      ? 'El cliente de este pedido fue eliminado'
                      : 'Editar cliente'
                  }
                  className={ACCION}
                >
                  <IconLapiz />
                  <span className="sr-only">
                    Editar cliente de {nombreCompleto}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPedidoEnEdicion(p)}
                  title="Editar pedido"
                  className={ACCION}
                >
                  <IconPedido />
                  <span className="sr-only">
                    Editar pedido #{p.id.slice(0, 8)}
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
                {rol === 'admin' && (
                  <button
                    type="button"
                    onClick={() => setPedidoAEliminar(p)}
                    title="Eliminar pedido"
                    className={`${ACCION} ml-auto text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30 dark:hover:text-red-300`}
                  >
                    <IconBasura />
                    <span className="sr-only">
                      Eliminar pedido #{p.id.slice(0, 8)}
                    </span>
                  </button>
                )}
              </div>
            </div>
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
          <p className="mt-3 border-t border-zinc-100 pt-2 text-right text-lg font-bold tabular-nums text-brand-orange-700 dark:border-zinc-800/60 dark:text-brand-orange">
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

      <AvisoFlotante aviso={aviso} />
    </div>
  );
}

export default function PedidosPage() {
  return <PedidosInterno />;
}
