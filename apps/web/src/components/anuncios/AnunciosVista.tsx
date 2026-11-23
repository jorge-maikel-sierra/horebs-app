'use client';

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import CargandoSkeleton from '@/components/CargandoSkeleton';
import ErrorInforme from '@/components/informes/ErrorInforme';
import PestanasInforme, { propsPanel } from '@/components/informes/PestanasInforme';
import SkeletonInforme from '@/components/informes/SkeletonInforme';
import { IconRefrescar } from '@/components/informes/iconos';
import SeccionAnuncios from '@/components/anuncios/secciones/SeccionAnuncios';
import SeccionCampanas from '@/components/anuncios/secciones/SeccionCampanas';
import SeccionClientes from '@/components/anuncios/secciones/SeccionClientes';
import SeccionPublicos from '@/components/anuncios/secciones/SeccionPublicos';
import SeccionResumen from '@/components/anuncios/secciones/SeccionResumen';
import { useRecurso } from '@/components/anuncios/use-recurso';
import { adminFetch } from '@/lib/admin-fetch';
import { tocar } from '@/lib/retroalimentacion';
import { leerErrorApi } from '@/lib/error-api';
import {
  GRUPO_PESTANAS,
  RANGOS_ANUNCIOS,
  VISTAS_ANUNCIOS,
  fechaCorta,
  fechaHaceDias,
  type Cohortes,
  type DiasRango,
  type PanelPublicos,
  type ResultadoPublicos,
  type Sincronizacion,
  type Tablero,
  type VistaAnuncios,
} from '@/components/anuncios/anuncios.tipos';

const DIAS_DEFECTO: DiasRango = 30;

/** ?vista=campanas&rango=90; un valor inválido cae al defecto. */
function leerUrl(sp: URLSearchParams): { vista: VistaAnuncios; dias: DiasRango } {
  const v = sp.get('vista');
  const vista = VISTAS_ANUNCIOS.some((x) => x.key === v) ? (v as VistaAnuncios) : 'resumen';
  const r = Number(sp.get('rango'));
  const dias = RANGOS_ANUNCIOS.find((x) => x.dias === r)?.dias ?? DIAS_DEFECTO;
  return { vista, dias };
}

function SelectorRango({ dias, onCambiar, ancho }: { dias: DiasRango; onCambiar: (d: DiasRango) => void; ancho?: boolean }) {
  const reducir = useReducedMotion();
  return (
    <div
      role="radiogroup"
      aria-label="Período"
      className={`flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900 ${ancho ? 'w-full' : ''}`}
    >
      {RANGOS_ANUNCIOS.map((r) => {
        const sel = r.dias === dias;
        return (
          <button
            key={r.dias}
            type="button"
            role="radio"
            aria-checked={sel}
            onClick={() => {
              if (!sel) tocar();
              onCambiar(r.dias);
            }}
            className={`relative h-9 rounded-lg px-3.5 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-brand-orange/60 focus-visible:outline-none ${
              ancho ? 'flex-1' : ''
            } ${sel ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'}`}
          >
            {sel && (
              <motion.span
                layoutId={ancho ? 'rango-anuncios-movil' : 'rango-anuncios'}
                transition={reducir ? { duration: 0 } : { type: 'spring', bounce: 0.18, duration: 0.4 }}
                className="absolute inset-0 rounded-lg bg-white shadow-sm dark:bg-zinc-700"
              />
            )}
            <span className="relative">{r.etiqueta}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Estado de carga y error de cada pestaña, igual en todas. */
function Contenido<T>({
  recurso,
  titulo,
  esqueleto,
  children,
}: {
  recurso: { datos: T | null; cargando: boolean; error: string | null; recargar: () => void };
  titulo: string;
  esqueleto: ReactNode;
  children: (datos: T) => ReactNode;
}) {
  if (recurso.error) return <ErrorInforme titulo={titulo} mensaje={recurso.error} onReintentar={recurso.recargar} />;
  if (!recurso.datos) return <>{esqueleto}</>;
  return (
    // Al cambiar de período lo anterior queda atenuado hasta que llega lo nuevo.
    <div
      aria-busy={recurso.cargando}
      className={`transition-opacity duration-200 ${recurso.cargando ? 'pointer-events-none opacity-50' : ''}`}
    >
      {children(recurso.datos)}
    </div>
  );
}

export default function AnunciosVista() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const barraRef = useRef<HTMLDivElement>(null);
  const { vista, dias } = leerUrl(sp);
  const desde = useMemo(() => fechaHaceDias(dias), [dias]);

  const tablero = useRecurso<Tablero>(`/admin/anuncios?desde=${desde}`, 'No se pudo cargar el tablero.');
  // Cohortes y públicos solo se piden cuando se abre su pestaña.
  const cohortes = useRecurso<Cohortes>(
    vista === 'clientes' ? `/admin/anuncios/cohortes?desde=${desde}` : null,
    'No se pudieron cargar las cohortes.',
  );
  const publicos = useRecurso<PanelPublicos>(
    vista === 'publicos' ? '/admin/audiencias' : null,
    'No se pudieron cargar los públicos.',
  );

  const [sincronizando, setSincronizando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviandoPublicos, setEnviandoPublicos] = useState(false);
  const [avisoPublicos, setAvisoPublicos] = useState<string | null>(null);

  function actualizar(cambios: Record<string, string | null>) {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(cambios)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }

  function cambiarVista(v: VistaAnuncios) {
    actualizar({ vista: v === 'resumen' ? null : v });
    const barra = barraRef.current;
    if (barra && window.scrollY > barra.offsetTop) {
      window.scrollTo({ top: barra.offsetTop, behavior: 'instant' });
    }
  }

  const cambiarDias = (d: DiasRango) => actualizar({ rango: d === DIAS_DEFECTO ? null : String(d) });

  async function sincronizar() {
    tocar();
    setSincronizando(true);
    setAviso(null);
    try {
      const res = await adminFetch('/admin/anuncios/sincronizaciones', { method: 'POST' });
      if (!res.ok) throw new Error(await leerErrorApi(res, 'No se pudo sincronizar con Meta.'));
      const r = (await res.json()) as Sincronizacion;
      setAviso(
        r.estado === 'apagado'
          ? 'Meta no está conectado: faltan META_AD_ACCOUNT_ID y el token con permiso ads_read en Railway.'
          : `Listo: ${r.filas} filas de gasto al día.`,
      );
      tablero.recargar();
    } catch (err) {
      setAviso(err instanceof Error ? err.message : 'No se pudo sincronizar con Meta.');
    } finally {
      setSincronizando(false);
    }
  }

  async function actualizarPublicos() {
    setEnviandoPublicos(true);
    setAvisoPublicos(null);
    try {
      const res = await adminFetch('/admin/audiencias/sincronizaciones', { method: 'POST' });
      if (!res.ok) throw new Error(await leerErrorApi(res, 'No se pudo sincronizar.'));
      const r = (await res.json()) as ResultadoPublicos;
      setAvisoPublicos(
        r.estado === 'apagado'
          ? 'Los envíos a Meta están apagados.'
          : r.errores.length > 0
            ? `Con errores: ${r.errores.join(' · ')}`
            : `Listo: ${r.enviadas.length} públicos actualizados.`,
      );
      publicos.recargar();
    } catch (err) {
      setAvisoPublicos(err instanceof Error ? err.message : 'No se pudo sincronizar.');
    } finally {
      setEnviandoPublicos(false);
    }
  }

  const gastoHasta = tablero.datos?.gasto_hasta;
  const recargando =
    (tablero.cargando && tablero.datos) ||
    (vista === 'clientes' && cohortes.cargando && cohortes.datos) ||
    (vista === 'publicos' && publicos.cargando && publicos.datos);

  const conTablero = (hijo: (t: Tablero) => ReactNode) => (
    <Contenido recurso={tablero} titulo="No pudimos cargar los anuncios" esqueleto={<SkeletonInforme />}>
      {hijo}
    </Contenido>
  );

  return (
    // @container: la grilla responde al ancho real del contenido (la barra
    // lateral se pliega), no al de la ventana.
    <div className="@container p-4 sm:p-6 lg:p-8">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 data-titulo-pagina className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
            Anuncios
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            <span>Últimos {dias} días</span>
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${gastoHasta ? 'bg-green-500' : 'bg-zinc-400'}`}
              />
              {tablero.datos
                ? gastoHasta
                  ? `Meta al día hasta el ${fechaCorta(gastoHasta)}`
                  : 'Meta sin sincronizar'
                : 'Cargando…'}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => void sincronizar()}
          disabled={sincronizando}
          aria-label={sincronizando ? 'Sincronizando con Meta' : 'Sincronizar con Meta'}
          className="btn-press inline-flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-800 transition-colors hover:border-zinc-300 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-brand-orange/60 focus-visible:outline-none disabled:opacity-60 @xl:w-auto @xl:px-4 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-900"
        >
          <span className={sincronizando ? 'animate-spin' : ''}>
            <IconRefrescar />
          </span>
          <span className="hidden @xl:inline">{sincronizando ? 'Sincronizando…' : 'Sincronizar con Meta'}</span>
        </button>
      </header>

      <div className="mt-4 @2xl:hidden">
        <SelectorRango dias={dias} onCambiar={cambiarDias} ancho />
      </div>

      <div
        ref={barraRef}
        className="sticky top-[61px] z-20 -mx-4 mt-3 border-b border-zinc-200/70 bg-white/80 px-4 py-2.5 backdrop-blur-md sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-8 lg:px-8 dark:border-zinc-800/70 dark:bg-zinc-950/80"
      >
        <div className="flex items-center gap-3">
          {/* En teléfono las cinco pestañas no caben: la tira se desliza, con
              los bordes desvanecidos y la pestaña activa centrada. */}
          <div
            data-tira-deslizable
            className="tira-desvanecida relative -mx-4 min-w-0 flex-1 snap-x overflow-x-auto px-4 [scrollbar-width:none] @2xl:mx-0 @2xl:flex-none @2xl:overflow-visible @2xl:px-0 @2xl:[mask-image:none] [&::-webkit-scrollbar]:hidden"
          >
            <PestanasInforme
              vistas={VISTAS_ANUNCIOS}
              activa={vista}
              onCambiar={cambiarVista}
              grupo={GRUPO_PESTANAS}
              etiqueta="Secciones de anuncios"
              className="w-max min-w-full"
            />
          </div>
          <div className="ml-auto hidden @2xl:block">
            <SelectorRango dias={dias} onCambiar={cambiarDias} />
          </div>
        </div>
        {recargando && (
          <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-brand-orange/15">
            <span className="btn-gradient animate-barra-carga absolute inset-y-0 w-1/3" />
          </span>
        )}
      </div>

      {aviso && (
        <p role="status" className="animate-fade-up mt-4 flex items-start justify-between gap-3 rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          <span>{aviso}</span>
          <button
            type="button"
            onClick={() => setAviso(null)}
            aria-label="Cerrar aviso"
            className="-my-1 shrink-0 rounded-md px-2 py-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ✕
          </button>
        </p>
      )}

      <div key={vista} {...propsPanel(vista, GRUPO_PESTANAS)} className="animate-entrada-seccion outline-none">
        {vista === 'resumen' && conTablero((t) => <SeccionResumen tablero={t} onIrA={cambiarVista} />)}
        {vista === 'campanas' && conTablero((t) => <SeccionCampanas campanas={t.campanas} />)}
        {vista === 'anuncios' && conTablero((t) => <SeccionAnuncios anuncios={t.anuncios} />)}
        {vista === 'clientes' && (
          <Contenido recurso={cohortes} titulo="No pudimos cargar las cohortes" esqueleto={<CargandoSkeleton filas={5} />}>
            {(d) => <SeccionClientes datos={d} />}
          </Contenido>
        )}
        {vista === 'publicos' && (
          <Contenido recurso={publicos} titulo="No pudimos cargar los públicos" esqueleto={<CargandoSkeleton filas={3} />}>
            {(d) => (
              <SeccionPublicos
                panel={d}
                enviando={enviandoPublicos}
                aviso={avisoPublicos}
                onActualizar={() => void actualizarPublicos()}
              />
            )}
          </Contenido>
        )}
      </div>
    </div>
  );
}
