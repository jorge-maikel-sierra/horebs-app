'use client';

import { useEffect, useState, type FormEvent } from 'react';
import RequireRol from '@/components/RequireRol';
import { adminFetch } from '@/lib/admin-fetch';
import CargandoSkeleton from '@/components/CargandoSkeleton';

type EstadoConversacion = 'bot' | 'derivado';

type Conversacion = {
  id: string;
  canal: 'whatsapp' | 'messenger' | 'instagram';
  identificador_externo: string;
  estado: EstadoConversacion;
  seguimiento_etapa: 'ninguna' | 'recordatorio_enviado' | 'oferta_enviada';
  seguimiento_enviado_en: string | null;
  ultima_interaccion: string;
};

const ETIQUETA_ETAPA: Record<Conversacion['seguimiento_etapa'], string> = {
  ninguna: 'Sin seguimiento',
  recordatorio_enviado: 'Recordatorio enviado',
  oferta_enviada: 'Oferta enviada',
};

const ETIQUETA_CANAL: Record<Conversacion['canal'], string> = {
  whatsapp: 'WhatsApp',
  messenger: 'Messenger',
  instagram: 'Instagram',
};

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function ConfiguracionSeguimiento() {
  const [recordatorioMinutos, setRecordatorioMinutos] = useState(180);
  const [ofertaMinutos, setOfertaMinutos] = useState(360);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    adminFetch('/admin/seguimiento/configuracion')
      .then(async (res) => {
        if (!res.ok) throw new Error('No se pudo cargar la configuración.');
        const data = await res.json();
        setRecordatorioMinutos(data.recordatorio_minutos);
        setOfertaMinutos(data.oferta_minutos);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Error desconocido.'),
      )
      .finally(() => setCargando(false));
  }, []);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMensaje(null);
    setGuardando(true);
    try {
      const res = await adminFetch('/admin/seguimiento/configuracion', {
        method: 'PATCH',
        body: JSON.stringify({
          recordatorio_minutos: recordatorioMinutos,
          oferta_minutos: ofertaMinutos,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? 'No se pudo guardar.');
      }
      setMensaje('Guardado.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <CargandoSkeleton filas={2} />;

  return (
    <form onSubmit={guardar} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-sm font-medium">
          Recordatorio (minutos sin respuesta)
        </label>
        <input
          required
          type="number"
          min={1}
          step={1}
          value={recordatorioMinutos}
          onChange={(e) => setRecordatorioMinutos(Number(e.target.value))}
          className="mt-1 w-40 rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">
          Oferta (minutos después del recordatorio)
        </label>
        <input
          required
          type="number"
          min={1}
          step={1}
          value={ofertaMinutos}
          onChange={(e) => setOfertaMinutos(Number(e.target.value))}
          className="mt-1 w-40 rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <button
        type="submit"
        disabled={guardando}
        className="rounded-lg bg-brand-orange px-4 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {guardando ? 'Guardando…' : 'Guardar'}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
      {mensaje && <p className="w-full text-sm text-brand-orange">{mensaje}</p>}
    </form>
  );
}

function ListaConversaciones() {
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    try {
      const res = await adminFetch('/admin/seguimiento/conversaciones');
      if (!res.ok) throw new Error('No se pudo cargar la lista.');
      setConversaciones(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function cambiarEstado(id: string, estado: EstadoConversacion) {
    setGuardandoId(id);
    try {
      const res = await adminFetch(`/admin/seguimiento/conversaciones/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ estado }),
      });
      if (!res.ok) throw new Error('No se pudo actualizar el estado.');
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido.');
    } finally {
      setGuardandoId(null);
    }
  }

  if (cargando) return <CargandoSkeleton filas={4} />;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (conversaciones.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Todavía no hay conversaciones con el bot.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {conversaciones.map((c) => (
        <li
          key={c.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
        >
          <div className="min-w-0">
            <p className="font-medium text-zinc-900 dark:text-zinc-50">
              {ETIQUETA_CANAL[c.canal]} · {c.identificador_externo}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Última actividad: {formatearFecha(c.ultima_interaccion)} ·{' '}
              {ETIQUETA_ETAPA[c.seguimiento_etapa]}
            </p>
          </div>
          <select
            value={c.estado}
            disabled={guardandoId === c.id}
            onChange={(e) =>
              cambiarEstado(c.id, e.target.value as EstadoConversacion)
            }
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm capitalize disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="bot">Bot respondiendo</option>
            <option value="derivado">Derivado a humano</option>
          </select>
        </li>
      ))}
    </ul>
  );
}

function SeguimientoInterna() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
        Seguimiento del bot
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Cuando un cliente habla con el bot y no llega a confirmar el pedido,
        se le manda un recordatorio y, si sigue sin responder, una oferta —
        ambos dentro de la ventana gratis de 24h de WhatsApp.
      </p>

      <div className="mt-6 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Tiempos
        </h2>
        <ConfiguracionSeguimiento />
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Conversaciones
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Cambiar el estado acá resetea la memoria del bot y cualquier
          seguimiento pendiente para esa conversación.
        </p>
        <div className="mt-3">
          <ListaConversaciones />
        </div>
      </div>
    </div>
  );
}

export default function SeguimientoPage() {
  return (
    <RequireRol roles={['admin']}>
      <SeguimientoInterna />
    </RequireRol>
  );
}
