'use client';

import { useState } from 'react';
import CargandoSkeleton from '@/components/CargandoSkeleton';
import { useRecurso } from '@/components/anuncios/use-recurso';
import { adminFetch } from '@/lib/admin-fetch';
import { leerErrorApi } from '@/lib/error-api';
import { formatPrecio } from '@/lib/formato';
import type { CampanaConResultado, CampanaMensajeria } from '@/lib/campanas-mensajeria';
import FormularioCampana from './FormularioCampana';
import TarjetaCampana from './TarjetaCampana';

type Resultados = { desde: string; campanas: CampanaConResultado[] };

/** null = cerrado; 'nueva' = crear; una campaña = editarla. */
type Edicion = null | 'nueva' | CampanaMensajeria;

function Resumen({ campanas }: { campanas: CampanaConResultado[] }) {
  const costo = campanas.reduce((s, c) => s + (c.costo ?? 0), 0);
  const ventas = campanas.reduce((s, c) => s + c.resultado.ventas, 0);
  const pedidos = campanas.reduce((s, c) => s + c.resultado.pedidos, 0);
  const datos = [
    { etiqueta: 'Campañas', valor: String(campanas.length) },
    { etiqueta: 'Pedidos atribuidos', valor: String(pedidos) },
    { etiqueta: 'Ventas', valor: formatPrecio(ventas) },
    { etiqueta: 'Invertido', valor: formatPrecio(costo) },
  ];
  return (
    <dl className="mt-5 grid grid-cols-2 gap-3 @2xl:grid-cols-4">
      {datos.map((d) => (
        <div key={d.etiqueta} className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <dt className="text-xs text-zinc-500 dark:text-zinc-400">{d.etiqueta}</dt>
          <dd className="mt-1 text-xl font-extrabold tracking-tight text-zinc-900 tabular-nums dark:text-zinc-50">
            {d.valor}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Campañas propias (difusiones de WhatsApp Business, bot, Messenger,
 * Instagram): se registran aquí, la caja las elige al digitar el pedido y
 * cada tarjeta muestra lo que trajo frente a lo que costó.
 */
export default function CampanasVista() {
  const { datos, cargando, error, recargar } = useRecurso<Resultados>(
    '/admin/campanas-mensajeria/resultados',
    'No se pudieron cargar las campañas.',
  );
  const [edicion, setEdicion] = useState<Edicion>(null);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function cambiarActiva(c: CampanaConResultado) {
    setOcupada(c.id);
    setAviso(null);
    try {
      const res = await adminFetch(`/admin/campanas-mensajeria/${c.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ activa: !c.activa }),
      });
      if (!res.ok) throw new Error(await leerErrorApi(res, 'No se pudo cambiar la campaña.'));
      recargar();
    } catch (err) {
      setAviso(err instanceof Error ? err.message : 'No se pudo cambiar la campaña.');
    } finally {
      setOcupada(null);
    }
  }

  return (
    <div className="@container mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Campañas propias</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
            Difusiones de WhatsApp Business y campañas por el bot, Messenger e Instagram. En la caja se elige
            la campaña al digitar el pedido. Últimos 90 días.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEdicion('nueva')}
          className="btn-press btn-gradient h-11 rounded-xl px-5 text-sm font-semibold text-white"
        >
          Nueva campaña
        </button>
      </div>

      {aviso && (
        <p role="alert" className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {aviso}
        </p>
      )}

      {error && (
        <div role="alert" className="mt-6 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}{' '}
          <button type="button" onClick={recargar} className="font-semibold underline">
            Reintentar
          </button>
        </div>
      )}

      {!datos && cargando && <CargandoSkeleton filas={4} />}

      {datos && (
        <>
          <Resumen campanas={datos.campanas} />
          {datos.campanas.length === 0 ? (
            <p className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              Todavía no hay campañas. Registrá la difusión del sábado antes de enviarla, así la caja la puede elegir.
            </p>
          ) : (
            <ul className="mt-5 grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3">
              {datos.campanas.map((c) => (
                <TarjetaCampana
                  key={c.id}
                  campana={c}
                  ocupada={ocupada === c.id}
                  onEditar={() => setEdicion(c)}
                  onCambiarActiva={() => void cambiarActiva(c)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {edicion && (
        <FormularioCampana
          campana={edicion === 'nueva' ? null : edicion}
          onCerrar={() => setEdicion(null)}
          onGuardada={() => {
            setEdicion(null);
            recargar();
          }}
        />
      )}
    </div>
  );
}
