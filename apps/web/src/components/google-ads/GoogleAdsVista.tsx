'use client';

import { useMemo, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import ErrorInforme from '@/components/informes/ErrorInforme';
import PestanasInforme, { propsPanel } from '@/components/informes/PestanasInforme';
import SkeletonInforme from '@/components/informes/SkeletonInforme';
import SeccionPalabras from '@/components/google-ads/secciones/SeccionPalabras';
import SeccionResumen from '@/components/google-ads/secciones/SeccionResumen';
import SeccionSegmentos from '@/components/google-ads/secciones/SeccionSegmentos';
import SeccionTerminos from '@/components/google-ads/secciones/SeccionTerminos';
import { useRecurso } from '@/components/anuncios/use-recurso';
import {
  GRUPO_PESTANAS_ADS,
  RANGOS_ADS,
  VISTAS_ADS,
  diaBogota,
  estadoSincronizacion,
  fechaCorta,
  fechaHora,
  type DiasAds,
  type EstadoSync,
  type TableroAds,
  type VistaAds,
} from '@/components/google-ads/google-ads.tipos';
import { etiquetaRango } from '@/lib/informes-rango';

const DIAS_DEFECTO: DiasAds = 28;

const PUNTO: Record<EstadoSync, string> = {
  al_dia: 'bg-green-500',
  viejo: 'bg-amber-500',
  muy_viejo: 'bg-red-600',
  sin_datos: 'bg-zinc-400',
};

function leerUrl(sp: URLSearchParams): { vista: VistaAds; dias: DiasAds } {
  const v = sp.get('vista');
  const vista = VISTAS_ADS.some((x) => x.key === v) ? (v as VistaAds) : 'resumen';
  const r = Number(sp.get('rango'));
  const dias = RANGOS_ADS.find((x) => x.dias === r)?.dias ?? DIAS_DEFECTO;
  return { vista, dias };
}

function SelectorRango({ dias, onCambiar, ancho }: { dias: DiasAds; onCambiar: (d: DiasAds) => void; ancho?: boolean }) {
  const reducir = useReducedMotion();
  return (
    <div role="radiogroup" aria-label="Período" className={`flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900 ${ancho ? 'w-full' : ''}`}>
      {RANGOS_ADS.map((r) => {
        const sel = r.dias === dias;
        return (
          <button
            key={r.dias}
            type="button"
            role="radio"
            aria-checked={sel}
            onClick={() => onCambiar(r.dias)}
            className={`relative h-9 rounded-lg px-3 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-brand-orange/60 focus-visible:outline-none ${
              ancho ? 'flex-1' : ''
            } ${sel ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'}`}
          >
            {sel && (
              <motion.span
                layoutId={ancho ? 'rango-gads-movil' : 'rango-gads'}
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

function EstadoSincronizacion({ t }: { t: TableroAds | null }) {
  if (!t) return <span>Cargando…</span>;
  const estado = estadoSincronizacion(t.sincronizacion.ultimo_envio);
  const texto =
    estado === 'sin_datos'
      ? 'Google Ads sin conectar'
      : `Datos hasta el ${t.sincronizacion.datos_hasta ? fechaCorta(t.sincronizacion.datos_hasta) : '—'} · recibido ${fechaHora(
          t.sincronizacion.ultimo_envio as string,
        )}`;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${PUNTO[estado]}`} />
      {texto}
      {(estado === 'viejo' || estado === 'muy_viejo') && <strong className="text-red-600 dark:text-red-400">(datos viejos)</strong>}
    </span>
  );
}

function SinConexion() {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
      <p className="font-semibold text-zinc-900 dark:text-zinc-50">El script de Google Ads aún no ha enviado datos.</p>
      <p className="mt-2">
        Se instala una vez en Google Ads → Herramientas → Secuencias de comandos, con el secreto de Railway, y se programa
        a diario a las 6:00 a.m. Los pasos están en <code>apps/api/docs/google-ads/README.md</code>.
      </p>
    </div>
  );
}

export default function GoogleAdsVista() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const barraRef = useRef<HTMLDivElement>(null);
  const { vista, dias } = leerUrl(sp);
  const hasta = useMemo(() => diaBogota(-1), []);
  const desde = useMemo(() => diaBogota(-dias), [dias]);
  const tablero = useRecurso<TableroAds>(`/admin/google-ads?desde=${desde}&hasta=${hasta}`, 'No se pudo cargar Google Ads.');

  function actualizar(cambios: Record<string, string | null>) {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(cambios)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }

  function cambiarVista(v: VistaAds) {
    actualizar({ vista: v === 'resumen' ? null : v });
    const barra = barraRef.current;
    if (barra && window.scrollY > barra.offsetTop) window.scrollTo({ top: barra.offsetTop, behavior: 'instant' });
  }

  const cambiarDias = (d: DiasAds) => actualizar({ rango: d === DIAS_DEFECTO ? null : String(d) });
  const t = tablero.datos;
  const sinDatos = t !== null && t.sincronizacion.ultimo_envio === null;

  return (
    <div className="@container p-4 sm:p-6 lg:p-8">
      <header className="min-w-0">
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Google Ads</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          <span>{etiquetaRango(desde, hasta)}</span>
          <EstadoSincronizacion t={t} />
        </p>
      </header>

      <div className="mt-4 @2xl:hidden">
        <SelectorRango dias={dias} onCambiar={cambiarDias} ancho />
      </div>

      <div
        ref={barraRef}
        className="sticky top-[61px] z-20 -mx-4 mt-3 border-b border-zinc-200/70 bg-white/80 px-4 py-2.5 backdrop-blur-md sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-8 lg:px-8 dark:border-zinc-800/70 dark:bg-zinc-950/80"
      >
        <div className="flex items-center gap-3">
          <div className="-mx-4 min-w-0 flex-1 overflow-x-auto px-4 [scrollbar-width:none] @2xl:mx-0 @2xl:flex-none @2xl:overflow-visible @2xl:px-0 [&::-webkit-scrollbar]:hidden">
            <PestanasInforme
              vistas={VISTAS_ADS}
              activa={vista}
              onCambiar={cambiarVista}
              grupo={GRUPO_PESTANAS_ADS}
              etiqueta="Secciones de Google Ads"
              className="w-max min-w-full"
            />
          </div>
          <div className="ml-auto hidden @2xl:block">
            <SelectorRango dias={dias} onCambiar={cambiarDias} />
          </div>
        </div>
        {tablero.cargando && t && (
          <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-brand-orange/15">
            <span className="btn-gradient animate-barra-carga absolute inset-y-0 w-1/3" />
          </span>
        )}
      </div>

      {sinDatos && <SinConexion />}

      <div key={vista} {...propsPanel(vista, GRUPO_PESTANAS_ADS)} className="outline-none">
        {tablero.error ? (
          <ErrorInforme titulo="No pudimos cargar Google Ads" mensaje={tablero.error} onReintentar={tablero.recargar} />
        ) : !t ? (
          <SkeletonInforme />
        ) : (
          <div
            aria-busy={tablero.cargando}
            className={`transition-opacity duration-200 ${tablero.cargando ? 'pointer-events-none opacity-50' : ''}`}
          >
            {vista === 'resumen' && <SeccionResumen t={t} />}
            {vista === 'palabras' && <SeccionPalabras t={t} />}
            {vista === 'terminos' && <SeccionTerminos t={t} />}
            {vista === 'segmentos' && <SeccionSegmentos t={t} />}
          </div>
        )}
      </div>
    </div>
  );
}
