'use client';

import { useEffect, useRef, useState } from 'react';
import AvisoFlotante from '@/components/AvisoFlotante';
import ModalConfirmar from '@/components/ModalConfirmar';
import FiltrosClientes from '@/components/clientes/FiltrosClientes';
import Paginacion from '@/components/clientes/Paginacion';
import ProgramaFidelidad from '@/components/clientes/ProgramaFidelidad';
import ResumenClientes from '@/components/clientes/ResumenClientes';
import TarjetaCliente from '@/components/clientes/TarjetaCliente';
import { IconLupa } from '@/components/clientes/iconos';
import { adminFetch } from '@/lib/admin-fetch';
import {
  POR_PAGINA,
  nombreCompleto,
  terminosBusqueda,
  type ClienteDirectorio,
  type Directorio,
  type OrdenClientes,
  type Segmento,
} from '@/lib/clientes-directorio';
import { hoyBogota } from '@/lib/semana';
import { useAviso } from '@/lib/use-aviso';
import { useDebounced } from '@/lib/use-debounced';
import { useRol } from '@/lib/use-rol';
import { leerErrorApi } from '@/lib/error-api';
import CargandoSkeleton from '@/components/CargandoSkeleton';

const NUMERO = new Intl.NumberFormat('es-CO');

export default function AdminClientesPage() {
  const { rol } = useRol();
  const esAdmin = rol === 'admin';
  const { aviso, mostrar } = useAviso();
  const [hoy] = useState(hoyBogota);

  const [q, setQ] = useState('');
  const [segmento, setSegmento] = useState<Segmento>('todos');
  const [orden, setOrden] = useState<OrdenClientes>('auto');
  const [pagina, setPagina] = useState(1);
  const [version, setVersion] = useState(0);
  const [valorPunto, setValorPunto] = useState<number | null>(null);
  const [aEliminar, setAEliminar] = useState<ClienteDirectorio | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const listaRef = useRef<HTMLDivElement>(null);

  // La búsqueda se envía al servidor con un pequeño debounce (también la
  // página, para no disparar una consulta por cada tecla).
  const aplicados = useDebounced(
    { q: q.trim(), segmento, orden, pagina, version },
    250,
  );
  const ruta = `/admin/clientes?${new URLSearchParams({
    vista: 'directorio',
    q: aplicados.q,
    segmento: aplicados.segmento,
    orden: aplicados.orden,
    pagina: String(aplicados.pagina),
    por_pagina: String(POR_PAGINA),
  })}`;

  // `version` sube al eliminar un cliente o reintentar: no viaja en la URL, pero
  // sí debe volver a disparar la consulta.
  const clave = `${ruta}|${aplicados.version}`;

  // Se conserva el resultado anterior mientras llega el nuevo: la lista no parpadea.
  const [resultado, setResultado] = useState<{
    ruta: string;
    datos: Directorio | null;
    fallo: boolean;
  } | null>(null);

  useEffect(() => {
    let vigente = true;
    adminFetch(ruta)
      .then((res) => (res.ok ? (res.json() as Promise<Directorio>) : null))
      .catch(() => null)
      .then((datos) => {
        if (!vigente) return;
        setResultado((previo) => ({
          ruta: clave,
          datos: datos ?? previo?.datos ?? null,
          fallo: datos === null,
        }));
      });
    return () => {
      vigente = false;
    };
    // `ruta` ya está contenida en `clave`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const datos = resultado?.datos ?? null;
  const actualizando = resultado?.ruta !== clave;
  const primeraCarga = resultado === null;
  const fallo = resultado?.fallo === true && !actualizando;
  const terminos = terminosBusqueda(aplicados.q);

  function cambiarQ(valor: string) {
    setQ(valor);
    setPagina(1);
  }
  function cambiarSegmento(valor: Segmento) {
    setSegmento(valor);
    setPagina(1);
  }
  function cambiarOrden(valor: OrdenClientes) {
    setOrden(valor);
    setPagina(1);
  }
  function irAPagina(valor: number) {
    setPagina(valor);
    listaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function limpiar() {
    setQ('');
    setSegmento('todos');
    setPagina(1);
  }

  async function confirmarEliminar() {
    const cliente = aEliminar;
    if (!cliente) return;
    setEliminando(true);
    try {
      const res = await adminFetch(`/admin/clientes/${cliente.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error(
          await leerErrorApi(res, 'No se pudo eliminar el cliente.'),
        );
      }
      mostrar(`${nombreCompleto(cliente)} eliminado`);
      setVersion((v) => v + 1);
    } catch (err) {
      mostrar(
        err instanceof Error ? err.message : 'No se pudo eliminar el cliente.',
        true,
      );
    } finally {
      setEliminando(false);
      setAEliminar(null);
    }
  }

  const hayFiltros = q.trim() !== '' || segmento !== 'todos';

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <header className="animate-fade-up">
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          Clientes
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Historial de compras y saldo de puntos de fidelidad.
        </p>
      </header>

      <div className="mt-6">
        <ResumenClientes
          resumen={datos?.resumen ?? null}
          valorPunto={valorPunto}
        />
      </div>

      {esAdmin && (
        <div className="mt-4">
          <ProgramaFidelidad
            onConfig={(c) => setValorPunto(c.valorPuntoPesos)}
            onAviso={mostrar}
          />
        </div>
      )}

      <div className="mt-6">
        <FiltrosClientes
          q={q}
          onQ={cambiarQ}
          segmento={segmento}
          onSegmento={cambiarSegmento}
          orden={orden}
          onOrden={cambiarOrden}
          conteos={datos?.conteos ?? null}
        />
      </div>

      <div ref={listaRef} className="scroll-mt-20" aria-busy={actualizando}>
        <p
          role="status"
          aria-live="polite"
          className="mt-5 min-h-5 text-sm text-zinc-500 tabular-nums dark:text-zinc-400"
        >
          {datos && (
            <>
              <span className="font-bold text-zinc-900 dark:text-zinc-50">
                {NUMERO.format(datos.total)}
              </span>{' '}
              cliente{datos.total === 1 ? '' : 's'}
              {aplicados.q && <> para “{aplicados.q}”</>}
            </>
          )}
        </p>

        {primeraCarga && <CargandoSkeleton filas={6} />}

        {fallo && !datos && (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            <p className="font-semibold">
              No se pudo cargar la lista de clientes.
            </p>
            <button
              type="button"
              onClick={() => setVersion((v) => v + 1)}
              className="btn-press mt-3 h-10 rounded-xl border border-red-300 px-4 font-semibold outline-none hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-500/60 dark:border-red-800 dark:hover:bg-red-950"
            >
              Reintentar
            </button>
          </div>
        )}

        {datos && datos.items.length === 0 && (
          <div className="animate-fade-up card-gradient mt-3 flex flex-col items-center rounded-3xl border border-dashed border-zinc-300 px-6 py-14 text-center dark:border-zinc-700">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-orange/15 text-accent-ink">
              <IconLupa />
            </span>
            <p className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {hayFiltros
                ? 'Ningún cliente coincide'
                : 'Todavía no hay clientes'}
            </p>
            <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
              {hayFiltros
                ? 'Revisa la ortografía, prueba con menos palabras o cambia el tipo de cliente.'
                : 'Los clientes aparecen aquí cuando hacen su primer pedido.'}
            </p>
            {hayFiltros && (
              <button
                type="button"
                onClick={limpiar}
                className="btn-gradient btn-press mt-5 h-11 rounded-xl px-5 text-sm font-semibold text-white shadow-md shadow-brand-orange/25 outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        )}

        {datos && datos.items.length > 0 && (
          <div
            key={resultado?.ruta}
            className={`mt-3 grid grid-cols-1 gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3 ${
              actualizando ? 'opacity-60' : ''
            }`}
          >
            {datos.items.map((c, i) => (
              <TarjetaCliente
                key={c.id}
                cliente={c}
                hoy={hoy}
                terminos={terminos}
                indice={i}
                puedeEliminar={esAdmin}
                onEliminar={setAEliminar}
              />
            ))}
          </div>
        )}
      </div>

      {datos && (
        <Paginacion
          pagina={datos.pagina}
          paginas={datos.paginas}
          total={datos.total}
          porPagina={datos.por_pagina}
          onCambiar={irAPagina}
        />
      )}

      {aEliminar && (
        <ModalConfirmar
          titulo="¿Eliminar este cliente?"
          descripcion={
            <>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {nombreCompleto(aEliminar)}
              </span>{' '}
              saldrá de la lista de clientes.
              {aEliminar.total_pedidos > 0 &&
                (aEliminar.total_pedidos === 1
                  ? ' Su pedido se conserva en los informes, pero sin vínculo al cliente.'
                  : ` Sus ${aEliminar.total_pedidos} pedidos se conservan en los informes, pero sin vínculo al cliente.`)}
              {aEliminar.puntos_actuales > 0 &&
                ` Perderá sus ${NUMERO.format(aEliminar.puntos_actuales)} puntos.`}{' '}
              Esta acción no se puede deshacer.
            </>
          }
          textoConfirmar="Eliminar"
          peligro
          cargando={eliminando}
          onConfirmar={confirmarEliminar}
          onCancelar={() => setAEliminar(null)}
        />
      )}

      <AvisoFlotante aviso={aviso} />
    </div>
  );
}
