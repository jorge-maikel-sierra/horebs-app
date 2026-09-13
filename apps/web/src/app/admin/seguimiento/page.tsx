'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import CargandoSkeleton from '@/components/CargandoSkeleton';
import { useRol } from '@/lib/use-rol';

type EstadoConversacion = 'bot' | 'derivado';
type DireccionMensaje = 'entrante' | 'saliente_bot' | 'saliente_humano';

type Conversacion = {
  id: string;
  canal: 'whatsapp' | 'messenger' | 'instagram';
  identificador_externo: string;
  estado: EstadoConversacion;
  seguimiento_etapa: 'ninguna' | 'recordatorio_enviado' | 'oferta_enviada';
  seguimiento_enviado_en: string | null;
  ultima_interaccion: string;
};

type Mensaje = {
  id: string;
  conversacion_id: string;
  direccion: DireccionMensaje;
  texto: string;
  autor_usuario_id: string | null;
  created_at: string;
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

// Bien por debajo del rate limit de 120 req/min de la API — cada callback
// además chequea document.hidden y no dispara el fetch con la pestaña en
// background.
const INTERVALO_LISTA_MS = 15_000;
const INTERVALO_HILO_MS = 5_000;

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function formatearHora(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    timeStyle: 'short',
  });
}

function IconEnviar() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
    </svg>
  );
}

function BadgeEstado({ estado }: { estado: EstadoConversacion }) {
  if (estado === 'derivado') {
    return (
      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
        Derivado
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
      Bot
    </span>
  );
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
      {error && <p className="w-full text-sm text-red-600 dark:text-red-400">{error}</p>}
      {mensaje && <p className="w-full text-sm text-brand-orange">{mensaje}</p>}
    </form>
  );
}

function ListaConversaciones() {
  const { session } = useRol();
  const usuarioId = session?.user.id ?? null;

  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [errorLista, setErrorLista] = useState<string | null>(null);

  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [cargandoMensajes, setCargandoMensajes] = useState(false);
  const [errorMensajes, setErrorMensajes] = useState<string | null>(null);

  const [textoRespuesta, setTextoRespuesta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [guardandoEstado, setGuardandoEstado] = useState(false);

  const hiloRef = useRef<HTMLDivElement>(null);
  // Si el empleado scrolleó hacia arriba para leer mensajes viejos, el
  // refresco automático cada 5s (o uno nuevo del bot/cliente) no debe
  // arrastrarlo de vuelta al final — solo seguimos pegados al final si ya
  // estaba ahí antes de que llegara la actualización.
  const cercaDelFinalRef = useRef(true);

  function manejarScrollHilo() {
    const el = hiloRef.current;
    if (!el) return;
    const distanciaAlFinal = el.scrollHeight - el.scrollTop - el.clientHeight;
    cercaDelFinalRef.current = distanciaAlFinal < 80;
  }

  async function cargarLista() {
    try {
      const res = await adminFetch('/admin/seguimiento/conversaciones');
      if (!res.ok) throw new Error('No se pudo cargar la lista.');
      setConversaciones(await res.json());
      setErrorLista(null);
    } catch (err) {
      setErrorLista(err instanceof Error ? err.message : 'Error desconocido.');
    } finally {
      setCargandoLista(false);
    }
  }

  // Primera carga + refresco periódico de la lista — se pausa si la
  // pestaña está en background para no gastar cupo del rate limit al
  // pedo.
  useEffect(() => {
    cargarLista();
    const id = setInterval(() => {
      if (!document.hidden) cargarLista();
    }, INTERVALO_LISTA_MS);
    return () => clearInterval(id);
  }, []);

  async function cargarMensajes(conversacionId: string, mostrarCarga: boolean) {
    if (mostrarCarga) setCargandoMensajes(true);
    try {
      const res = await adminFetch(
        `/admin/seguimiento/conversaciones/${conversacionId}/mensajes`,
      );
      if (!res.ok) throw new Error('No se pudo cargar la conversación.');
      setMensajes(await res.json());
      setErrorMensajes(null);
    } catch (err) {
      setErrorMensajes(
        err instanceof Error ? err.message : 'Error desconocido.',
      );
    } finally {
      if (mostrarCarga) setCargandoMensajes(false);
    }
  }

  // Un solo hilo abierto a la vez — al cambiar de conversación se limpia
  // el intervalo anterior y arranca uno nuevo para la conversación actual.
  useEffect(() => {
    if (!seleccionadoId) return;
    // Conversación recién abierta — arranca pegada al final, como
    // WhatsApp, sin importar dónde había quedado el scroll de la anterior.
    cercaDelFinalRef.current = true;
    cargarMensajes(seleccionadoId, true);
    const id = setInterval(() => {
      if (!document.hidden) cargarMensajes(seleccionadoId, false);
    }, INTERVALO_HILO_MS);
    return () => clearInterval(id);
  }, [seleccionadoId]);

  useEffect(() => {
    if (!cercaDelFinalRef.current) return;
    hiloRef.current?.scrollTo({ top: hiloRef.current.scrollHeight });
  }, [mensajes]);

  const seleccionado =
    conversaciones.find((c) => c.id === seleccionadoId) ?? null;

  async function cambiarEstado(estado: EstadoConversacion) {
    if (!seleccionado) return;
    setGuardandoEstado(true);
    try {
      const res = await adminFetch(
        `/admin/seguimiento/conversaciones/${seleccionado.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ estado }),
        },
      );
      if (!res.ok) throw new Error('No se pudo actualizar el estado.');
      await cargarLista();
    } catch (err) {
      setErrorLista(err instanceof Error ? err.message : 'Error desconocido.');
    } finally {
      setGuardandoEstado(false);
    }
  }

  async function enviarMensaje(e: FormEvent) {
    e.preventDefault();
    if (!seleccionado || !textoRespuesta.trim()) return;
    setEnviando(true);
    setErrorEnvio(null);
    try {
      const res = await adminFetch(
        `/admin/seguimiento/conversaciones/${seleccionado.id}/mensajes`,
        {
          method: 'POST',
          body: JSON.stringify({ texto: textoRespuesta.trim() }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? 'No se pudo enviar el mensaje.');
      }
      setTextoRespuesta('');
      cercaDelFinalRef.current = true;
      await cargarMensajes(seleccionado.id, false);
    } catch (err) {
      setErrorEnvio(err instanceof Error ? err.message : 'No se pudo enviar.');
    } finally {
      setEnviando(false);
    }
  }

  if (cargandoLista) return <CargandoSkeleton filas={4} />;
  if (errorLista && conversaciones.length === 0) {
    return <p className="text-sm text-red-600 dark:text-red-400">{errorLista}</p>;
  }

  return (
    <div className="mt-3 grid gap-4 lg:grid-cols-[320px_1fr]">
      {/* Columna izquierda: lista de conversaciones */}
      <div className="h-[calc(100vh-16rem)] min-h-[28rem] overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        {conversaciones.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">
            Todavía no hay conversaciones con el bot.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {conversaciones.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSeleccionadoId(c.id)}
                  className={`block w-full px-3 py-3 text-left transition-colors ${
                    c.id === seleccionadoId
                      ? 'bg-brand-orange/10'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {ETIQUETA_CANAL[c.canal]} · {c.identificador_externo}
                    </p>
                    <BadgeEstado estado={c.estado} />
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {formatearFecha(c.ultima_interaccion)} ·{' '}
                    {ETIQUETA_ETAPA[c.seguimiento_etapa]}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Columna derecha: hilo de la conversación seleccionada */}
      <div className="flex h-[calc(100vh-16rem)] min-h-[28rem] flex-col rounded-lg border border-zinc-200 dark:border-zinc-800">
        {!seleccionado ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Elegí una conversación de la lista para ver el hilo de mensajes.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-3 dark:border-zinc-800">
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                  {ETIQUETA_CANAL[seleccionado.canal]} ·{' '}
                  {seleccionado.identificador_externo}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Última actividad: {formatearFecha(seleccionado.ultima_interaccion)}
                </p>
              </div>
              <select
                value={seleccionado.estado}
                disabled={guardandoEstado}
                onChange={(e) =>
                  cambiarEstado(e.target.value as EstadoConversacion)
                }
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="bot">Bot respondiendo</option>
                <option value="derivado">Derivado a humano</option>
              </select>
            </div>

            <div
              ref={hiloRef}
              onScroll={manejarScrollHilo}
              className="flex-1 space-y-2 overflow-y-auto p-3"
            >
              {cargandoMensajes ? (
                <CargandoSkeleton filas={3} />
              ) : errorMensajes ? (
                <p className="text-sm text-red-600 dark:text-red-400">{errorMensajes}</p>
              ) : mensajes.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Todavía no hay mensajes en esta conversación.
                </p>
              ) : (
                mensajes.map((m) => {
                  const esEntrante = m.direccion === 'entrante';
                  const etiqueta =
                    m.direccion === 'entrante'
                      ? 'Cliente'
                      : m.direccion === 'saliente_bot'
                        ? 'Bot'
                        : m.autor_usuario_id === usuarioId
                          ? 'Vos'
                          : 'Equipo';
                  return (
                    <div
                      key={m.id}
                      className={`flex ${esEntrante ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                          esEntrante
                            ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50'
                            : 'bg-brand-orange/15 text-zinc-900 dark:text-zinc-50'
                        }`}
                      >
                        <p className="mb-0.5 text-[10px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                          {etiqueta} · {formatearHora(m.created_at)}
                        </p>
                        <p className="whitespace-pre-wrap">{m.texto}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
              {seleccionado.estado !== 'derivado' ? (
                <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                  El bot está atendiendo esta conversación — cambiá el estado
                  a &quot;Derivado a humano&quot; para poder responder desde
                  acá.
                </p>
              ) : (
                <form onSubmit={enviarMensaje} className="flex items-end gap-2">
                  <textarea
                    value={textoRespuesta}
                    onChange={(e) => setTextoRespuesta(e.target.value)}
                    maxLength={4096}
                    rows={2}
                    placeholder="Escribí una respuesta…"
                    className="flex-1 resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  <button
                    type="submit"
                    disabled={enviando || !textoRespuesta.trim()}
                    className="btn-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-orange text-white disabled:opacity-50"
                    aria-label="Enviar mensaje"
                  >
                    <IconEnviar />
                  </button>
                </form>
              )}
              {errorEnvio && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">{errorEnvio}</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ModalConfiguracion({ onCerrar }: { onCerrar: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="animate-fade-in absolute inset-0" onClick={onCerrar} />
      <div className="animate-fade-up relative w-full max-w-lg rounded-lg bg-white p-6 dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Tiempos de seguimiento
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="text-xl leading-none text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            ×
          </button>
        </div>
        <div className="mt-4">
          <ConfiguracionSeguimiento />
        </div>
      </div>
    </div>
  );
}

function SeguimientoInterna() {
  const [configAbierta, setConfigAbierta] = useState(false);

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
            Seguimiento del bot
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Cuando un cliente habla con el bot y no llega a confirmar el
            pedido, se le manda un recordatorio y, si sigue sin responder,
            una oferta — ambos dentro de la ventana gratis de 24h de
            WhatsApp.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConfigAbierta(true)}
          className="shrink-0 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Configurar tiempos
        </button>
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Conversaciones
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Elegí una conversación derivada para leer qué escribió el cliente y
          responderle directamente desde acá.
        </p>
        <ListaConversaciones />
      </div>

      {configAbierta && (
        <ModalConfiguracion onCerrar={() => setConfigAbierta(false)} />
      )}
    </div>
  );
}

export default function SeguimientoPage() {
  return <SeguimientoInterna />;
}
