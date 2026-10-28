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
import { leerErrorApi } from '@/lib/error-api';

type ClaveCorreo = 'correo_domiciliario' | 'correo_avisos_bot';
type Correos = Record<ClaveCorreo, string>;

/** Una tarjeta por correo: cada una guarda solo su propia clave. */
function TarjetaCorreo({
  clave,
  titulo,
  descripcion,
  etiqueta,
  valorInicial,
  cargando,
  onGuardado,
}: {
  clave: ClaveCorreo;
  titulo: string;
  descripcion: string;
  etiqueta: string;
  valorInicial: string;
  cargando: boolean;
  onGuardado: () => void;
}) {
  const idCorreo = useId();
  const [correo, setCorreo] = useState(valorInicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      const res = await adminFetch('/admin/configuracion', {
        method: 'PATCH',
        body: JSON.stringify({ [clave]: correo }),
      });
      if (!res.ok) {
        throw new Error(
          await leerErrorApi(res, 'No se pudo guardar.'),
        );
      }
      onGuardado();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className={TARJETA}>
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        {titulo}
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {descripcion}
      </p>

      {cargando ? (
        <CargandoSkeleton filas={1} />
      ) : (
        <form onSubmit={guardar} className="mt-4 space-y-4">
          <Campo id={idCorreo} etiqueta={etiqueta} error={error ?? undefined}>
            <input
              id={idCorreo}
              required
              type="email"
              inputMode="email"
              autoComplete="off"
              value={correo}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${idCorreo}-error` : undefined}
              onChange={(e) => setCorreo(e.target.value)}
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
  );
}

function ConfiguracionInterna() {
  const { aviso, mostrar } = useAviso();
  const [correos, setCorreos] = useState<Correos | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch('/admin/configuracion')
      .then(async (res) => {
        if (!res.ok) throw new Error('No se pudo cargar la configuración.');
        const data = await res.json();
        setCorreos({
          correo_domiciliario: data.correo_domiciliario ?? '',
          correo_avisos_bot: data.correo_avisos_bot ?? '',
        });
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Error desconocido.'),
      );
  }, []);

  const cargando = correos === null && !error;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
        Configuración
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Ajustes generales del negocio y del panel.
      </p>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
        <SeccionModulos onAviso={mostrar} />

        <div className="grid gap-6">
          {/* key: el valor inicial llega después de la carga */}
          <TarjetaCorreo
            key={`domiciliario-${cargando}`}
            clave="correo_domiciliario"
            titulo="Avisos de domicilio"
            descripcion="Cada vez que se cree un pedido con envío a domicilio (web o punto de venta), se le avisa por correo a esta dirección."
            etiqueta="Correo del domiciliario"
            valorInicial={correos?.correo_domiciliario ?? ''}
            cargando={cargando}
            onGuardado={() => mostrar('Configuración guardada')}
          />
          <TarjetaCorreo
            key={`avisos-bot-${cargando}`}
            clave="correo_avisos_bot"
            titulo="Avisos del bot de WhatsApp"
            descripcion="Cuando el bot pasa una conversación a una persona del equipo, llega un correo a esta dirección con el cliente, el pedido y un botón para escribirle por WhatsApp."
            etiqueta="Correo para avisos del bot"
            valorInicial={correos?.correo_avisos_bot ?? ''}
            cargando={cargando}
            onGuardado={() => mostrar('Configuración guardada')}
          />
        </div>
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
