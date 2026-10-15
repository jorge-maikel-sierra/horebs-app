'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import AvisoFlotante from '@/components/AvisoFlotante';
import CargandoSkeleton from '@/components/CargandoSkeleton';
import RequireRol from '@/components/RequireRol';
import SeccionModulos from '@/components/configuracion/SeccionModulos';
import Campo from '@/components/formulario/Campo';
import { TARJETA, claseCampo } from '@/components/formulario/estilos';
import { adminFetch } from '@/lib/admin-fetch';
import { useAviso } from '@/lib/use-aviso';

function ConfiguracionInterna() {
  const idCorreo = useId();
  const { aviso, mostrar } = useAviso();
  const [correoDomiciliario, setCorreoDomiciliario] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch('/admin/configuracion')
      .then(async (res) => {
        if (!res.ok) throw new Error('No se pudo cargar la configuración.');
        const data = await res.json();
        setCorreoDomiciliario(data.correo_domiciliario ?? '');
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Error desconocido.'),
      )
      .finally(() => setCargando(false));
  }, []);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      const res = await adminFetch('/admin/configuracion', {
        method: 'PATCH',
        body: JSON.stringify({ correo_domiciliario: correoDomiciliario }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          typeof body?.message === 'string'
            ? body.message
            : 'No se pudo guardar.',
        );
      }
      mostrar('Configuración guardada');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
        Configuración
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Ajustes generales del negocio y del panel.
      </p>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
        <SeccionModulos onAviso={mostrar} />

        <section className={TARJETA}>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Avisos de domicilio
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Cada vez que se cree un pedido con envío a domicilio (web o punto de
            venta), se le avisa por correo a esta dirección.
          </p>

          {cargando ? (
            <CargandoSkeleton filas={1} />
          ) : (
            <form onSubmit={guardar} className="mt-4 space-y-4">
              <Campo
                id={idCorreo}
                etiqueta="Correo del domiciliario"
                error={error ?? undefined}
              >
                <input
                  id={idCorreo}
                  required
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  value={correoDomiciliario}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? `${idCorreo}-error` : undefined}
                  onChange={(e) => setCorreoDomiciliario(e.target.value)}
                  className={claseCampo(Boolean(error))}
                />
              </Campo>

              <button
                type="submit"
                disabled={guardando}
                className="btn-gradient btn-press h-11 rounded-xl px-5 text-sm font-semibold text-white shadow-md shadow-brand-orange/25 outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 disabled:opacity-60"
              >
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </form>
          )}
        </section>
      </div>

      <AvisoFlotante aviso={aviso} />
    </div>
  );
}

export default function ConfiguracionPage() {
  return (
    <RequireRol roles={['admin']}>
      <ConfiguracionInterna />
    </RequireRol>
  );
}
