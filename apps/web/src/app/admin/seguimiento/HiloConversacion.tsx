'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { useHilo } from './hooks';
import {
  IconBot,
  IconEnviar,
  IconFlechaAbajo,
  IconPersona,
  IconVolver,
  InsigniaCanal,
} from './iconos';
import {
  ETIQUETA_CANAL,
  ETIQUETA_ETAPA,
  type Conversacion,
  type EstadoConversacion,
  type Mensaje,
} from './tipos';
import {
  agruparMensajes,
  formatearHora,
  nombreCliente,
  tiempoRelativo,
  tituloDia,
} from './utilidades';

const ANILLO =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)]';
const MAX_CARACTERES = 4096;
const AVISO_CARACTERES = 3500;
const ALTO_MAXIMO_PX = 144;
const DISTANCIA_AL_FINAL_PX = 80;
const ANCHO_ESCRITORIO_PX = 1024;

type Props = {
  conversacion: Conversacion;
  usuarioId: string | null;
  ahora: number;
  onVolver: () => void;
  onCambiarEstado: (
    id: string,
    estado: EstadoConversacion,
  ) => Promise<string | null>;
};

function autor(m: Mensaje, usuarioId: string | null) {
  if (m.direccion === 'entrante') return 'cliente' as const;
  if (m.direccion === 'saliente_bot') return 'bot' as const;
  return m.autor_usuario_id === usuarioId ? ('tu' as const) : ('equipo' as const);
}

const ETIQUETA_AUTOR = { bot: 'Bot', tu: 'Tú', equipo: 'Equipo' } as const;

const ESTILO_BURBUJA = {
  cliente:
    'rounded-bl-md border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50',
  bot: 'rounded-br-md border border-brand-navy/15 bg-brand-navy/[0.07] text-zinc-900 dark:border-sky-900/70 dark:bg-sky-950/70 dark:text-zinc-50',
  equipo:
    'rounded-br-md border border-brand-orange/30 bg-brand-orange/20 text-zinc-900 dark:text-zinc-50',
  tu: 'rounded-br-md bg-brand-orange text-zinc-950',
} as const;

function Burbuja({
  m,
  usuarioId,
  inicioDeRacha,
}: {
  m: Mensaje;
  usuarioId: string | null;
  inicioDeRacha: boolean;
}) {
  const quien = autor(m, usuarioId);
  const propio = quien !== 'cliente';
  return (
    <div
      className={`flex flex-col ${propio ? 'items-end' : 'items-start'} ${
        inicioDeRacha ? 'mt-3' : 'mt-0.5'
      }`}
    >
      {inicioDeRacha && propio && (
        <span className="mb-1 inline-flex items-center gap-1 px-1 font-mono text-[10px] font-semibold tracking-[0.12em] text-zinc-600 uppercase dark:text-zinc-400">
          {quien === 'bot' ? (
            <IconBot className="h-3 w-3" />
          ) : (
            <IconPersona className="h-3 w-3" />
          )}
          {ETIQUETA_AUTOR[quien]}
        </span>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2 sm:max-w-[75%] ${ESTILO_BURBUJA[quien]}`}
      >
        <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">
          {m.texto}
        </p>
        <time
          dateTime={m.created_at}
          className="mt-0.5 block text-right font-mono text-[10px] opacity-70"
        >
          {formatearHora(m.created_at)}
        </time>
      </div>
    </div>
  );
}

function Composer({
  conversacion,
  enviar,
  onCambiarEstado,
}: {
  conversacion: Conversacion;
  enviar: (texto: string) => Promise<string | null>;
  onCambiarEstado: Props['onCambiarEstado'];
}) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [cambiando, setCambiando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const derivado = conversacion.estado === 'derivado';

  function ajustarAlto() {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, ALTO_MAXIMO_PX)}px`;
  }

  async function cambiar(estado: EstadoConversacion) {
    setCambiando(true);
    setError(await onCambiarEstado(conversacion.id, estado));
    setCambiando(false);
  }

  async function mandar(e?: FormEvent) {
    e?.preventDefault();
    const limpio = texto.trim();
    if (!limpio || enviando) return;
    setEnviando(true);
    setError(null);
    const fallo = await enviar(limpio);
    setEnviando(false);
    if (fallo) {
      setError(fallo);
      return;
    }
    setTexto('');
    requestAnimationFrame(ajustarAlto);
  }

  function alTeclear(e: KeyboardEvent<HTMLTextAreaElement>) {
    // En celular Enter es salto de línea; se envía con el botón.
    if (window.matchMedia('(pointer: coarse)').matches) return;
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void mandar();
    }
  }

  if (!derivado) {
    return (
      <div className="border-t border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-md text-sm text-zinc-700 dark:text-zinc-300">
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">
              El bot está atendiendo.
            </span>{' '}
            Si tomas la conversación, el bot deja de responder y los mensajes
            los escribes tú.
          </p>
          <button
            type="button"
            disabled={cambiando}
            onClick={() => cambiar('derivado')}
            className={`btn-gradient btn-press inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white disabled:opacity-60 ${ANILLO} focus-visible:ring-offset-2`}
          >
            <IconPersona className="h-4 w-4" />
            {cambiando ? 'Tomando…' : 'Tomar la conversación'}
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
      <form onSubmit={mandar} className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor="respuesta" className="sr-only">
            Respuesta para el cliente
          </label>
          <textarea
            id="respuesta"
            ref={areaRef}
            rows={1}
            value={texto}
            maxLength={MAX_CARACTERES}
            onChange={(e) => {
              setTexto(e.target.value);
              ajustarAlto();
            }}
            onKeyDown={alTeclear}
            placeholder="Escribe una respuesta…"
            className={`max-h-36 min-h-11 w-full resize-none rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 text-[15px] leading-relaxed text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 ${ANILLO}`}
          />
        </div>
        <button
          type="submit"
          disabled={enviando || !texto.trim()}
          aria-label="Enviar mensaje"
          className={`btn-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-orange text-zinc-950 transition-opacity disabled:opacity-40 ${ANILLO} focus-visible:ring-offset-2`}
        >
          <IconEnviar className="h-5 w-5" />
        </button>
      </form>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-600 max-sm:justify-end dark:text-zinc-400">
        <span className="hidden sm:inline">
          <kbd className="font-mono">Enter</kbd> envía ·{' '}
          <kbd className="font-mono">Shift + Enter</kbd> salto de línea
          {texto.length > AVISO_CARACTERES && (
            <span className="ml-2 font-mono text-[var(--accent-ink)]">
              {texto.length}/{MAX_CARACTERES}
            </span>
          )}
        </span>
        <button
          type="button"
          disabled={cambiando}
          onClick={() => cambiar('bot')}
          className={`min-h-10 rounded-lg px-2 font-semibold underline decoration-dotted underline-offset-4 hover:text-zinc-900 disabled:opacity-60 dark:hover:text-zinc-100 ${ANILLO}`}
        >
          {cambiando ? 'Devolviendo…' : 'Devolver al bot'}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export default function HiloConversacion({
  conversacion,
  usuarioId,
  ahora,
  onVolver,
  onCambiarEstado,
}: Props) {
  const { mensajes, cargando, error, enviar } = useHilo(conversacion.id);
  const grupos = useMemo(() => agruparMensajes(mensajes), [mensajes]);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const hiloRef = useRef<HTMLDivElement>(null);
  // Si el empleado subió a leer mensajes viejos, el refresco automático no
  // debe arrastrarlo de vuelta al final: solo seguimos pegados al final si ya
  // estaba ahí cuando llegó la actualización.
  const cercaDelFinal = useRef(true);
  const cantidadPrevia = useRef(0);
  const [nuevos, setNuevos] = useState(0);

  // En celular la conversación ocupa toda la pantalla: el foco pasa al título
  // para que lectores de pantalla y teclado sepan dónde están.
  useEffect(() => {
    if (window.innerWidth < ANCHO_ESCRITORIO_PX) tituloRef.current?.focus();
  }, []);

  useEffect(() => {
    const el = hiloRef.current;
    if (!el) return;
    const llegaron = mensajes.length - cantidadPrevia.current;
    if (cercaDelFinal.current) {
      el.scrollTo({ top: el.scrollHeight });
      setNuevos(0);
    } else if (cantidadPrevia.current > 0 && llegaron > 0) {
      setNuevos((n) => n + llegaron);
    }
    cantidadPrevia.current = mensajes.length;
  }, [mensajes]);

  function alHacerScroll() {
    const el = hiloRef.current;
    if (!el) return;
    cercaDelFinal.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < DISTANCIA_AL_FINAL_PX;
    if (cercaDelFinal.current) setNuevos(0);
  }

  function irAlFinal() {
    hiloRef.current?.scrollTo({
      top: hiloRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }

  async function enviarYBajar(texto: string) {
    cercaDelFinal.current = true;
    return enviar(texto);
  }

  const derivado = conversacion.estado === 'derivado';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-zinc-200 px-3 py-3 sm:px-4 dark:border-zinc-800">
        <button
          type="button"
          onClick={onVolver}
          aria-label="Volver a la lista de conversaciones"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100 lg:hidden dark:text-zinc-300 dark:hover:bg-zinc-800 ${ANILLO}`}
        >
          <IconVolver className="h-5 w-5" />
        </button>
        <InsigniaCanal canal={conversacion.canal} />
        <div className="min-w-0 flex-1">
          <h2
            ref={tituloRef}
            tabIndex={-1}
            className="truncate text-base font-semibold text-zinc-900 focus:outline-none dark:text-zinc-50"
          >
            {nombreCliente(conversacion)}
          </h2>
          <p className="truncate text-xs text-zinc-600 dark:text-zinc-400">
            {ETIQUETA_CANAL[conversacion.canal]} · activo{' '}
            {tiempoRelativo(conversacion.ultima_interaccion, ahora)} ·{' '}
            {ETIQUETA_ETAPA[conversacion.seguimiento_etapa]}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            derivado
              ? 'bg-brand-orange/15 text-[var(--accent-ink)]'
              : 'bg-brand-navy/10 text-brand-navy dark:bg-sky-950 dark:text-sky-200'
          }`}
        >
          {derivado ? (
            <IconPersona className="h-3.5 w-3.5" />
          ) : (
            <IconBot className="h-3.5 w-3.5" />
          )}
          <span className="sm:hidden">{derivado ? 'Equipo' : 'Bot'}</span>
          <span className="hidden sm:inline">
            {derivado ? 'Atiende el equipo' : 'Atiende el bot'}
          </span>
        </span>
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          ref={hiloRef}
          onScroll={alHacerScroll}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Mensajes de la conversación"
          className="h-full overflow-y-auto bg-zinc-50 px-3 py-4 sm:px-5 dark:bg-zinc-950/60"
        >
          {cargando ? (
            <div className="space-y-3" aria-hidden="true">
              <div className="skeleton h-12 w-2/3 rounded-2xl" />
              <div className="skeleton ml-auto h-16 w-3/5 rounded-2xl" />
              <div className="skeleton h-10 w-1/2 rounded-2xl" />
            </div>
          ) : error ? (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              {error}
            </p>
          ) : grupos.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-600 dark:text-zinc-400">
              Todavía no hay mensajes en esta conversación.
            </p>
          ) : (
            grupos.map((g) => (
              <section key={g.dia} aria-label={tituloDia(g.dia, ahora)}>
                <h3 className="sticky top-0 z-10 my-2 flex justify-center">
                  <span className="rounded-full border border-zinc-200 bg-white/95 px-3 py-0.5 font-mono text-[10px] font-semibold tracking-[0.12em] text-zinc-600 uppercase backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-400">
                    {tituloDia(g.dia, ahora)}
                  </span>
                </h3>
                {g.bloques.map(({ mensaje, inicioDeRacha }) => (
                  <Burbuja
                    key={mensaje.id}
                    m={mensaje}
                    usuarioId={usuarioId}
                    inicioDeRacha={inicioDeRacha}
                  />
                ))}
              </section>
            ))
          )}
        </div>
        {nuevos > 0 && (
          <button
            type="button"
            onClick={irAlFinal}
            className={`animate-pop-in absolute bottom-3 left-1/2 inline-flex min-h-10 -translate-x-1/2 items-center gap-2 rounded-full bg-zinc-900 px-4 text-sm font-semibold text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900 ${ANILLO} focus-visible:ring-offset-2`}
          >
            <IconFlechaAbajo className="h-4 w-4" />
            {nuevos === 1 ? '1 mensaje nuevo' : `${nuevos} mensajes nuevos`}
          </button>
        )}
      </div>

      <Composer
        key={conversacion.id}
        conversacion={conversacion}
        enviar={enviarYBajar}
        onCambiarEstado={onCambiarEstado}
      />
    </div>
  );
}
