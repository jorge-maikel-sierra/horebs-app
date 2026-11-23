'use client';

import { useMemo, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import ErrorInforme from '@/components/informes/ErrorInforme';
import PestanasInforme, { VISTAS, propsPanel, type VistaInforme } from '@/components/informes/PestanasInforme';
import SelectorPeriodo, { rangoCorto } from '@/components/informes/SelectorPeriodo';
import SkeletonInforme from '@/components/informes/SkeletonInforme';
import SeccionBots from '@/components/informes/secciones/SeccionBots';
import SeccionClientes from '@/components/informes/secciones/SeccionClientes';
import SeccionProductos from '@/components/informes/secciones/SeccionProductos';
import SeccionResumen from '@/components/informes/secciones/SeccionResumen';
import { useInforme } from '@/components/informes/use-informe';
import { plural } from '@/components/informes/informes.tipos';
import {
  PRESETS_INFORME,
  calcularRango,
  diasEntre,
  etiquetaRango,
  type RangoPreset,
} from '@/lib/informes-rango';

const FECHA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;
const PRESET_DEFECTO: RangoPreset = '7dias';

/**
 * Lee vista y período de la URL (?vista=clientes&rango=mes, o
 * rango=personalizado&desde=…&hasta=…). Un valor inválido cae al defecto en
 * vez de romper: la URL se puede compartir y volver atrás funciona.
 */
function leerUrl(sp: URLSearchParams) {
  const v = sp.get('vista');
  const vista: VistaInforme = VISTAS.some((x) => x.key === v) ? (v as VistaInforme) : 'resumen';
  const r = sp.get('rango');
  const d = sp.get('desde') ?? '';
  const h = sp.get('hasta') ?? '';
  if (r === 'personalizado' && FECHA_VALIDA.test(d) && FECHA_VALIDA.test(h) && d <= h) {
    return { vista, preset: 'personalizado' as RangoPreset, desde: d, hasta: h };
  }
  const preset = PRESETS_INFORME.some((p) => p.key === r) ? (r as RangoPreset) : PRESET_DEFECTO;
  return { vista, preset, desde: '', hasta: '' };
}

export default function InformesVista() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const barraRef = useRef<HTMLDivElement>(null);

  const url = leerUrl(sp);
  const { vista, preset } = url;
  const rango = useMemo(
    () => (preset === 'personalizado' ? { desde: url.desde, hasta: url.hasta } : calcularRango(preset)),
    [preset, url.desde, url.hasta],
  );
  const { desde, hasta } = rango;
  const { informe, anterior, cargando, error, reintentar } = useInforme(desde, hasta);

  function actualizar(cambios: Record<string, string | null>) {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(cambios)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }

  function cambiarVista(v: VistaInforme) {
    actualizar({ vista: v === 'resumen' ? null : v });
    // Si el usuario venía leyendo abajo, la sección nueva arranca desde su
    // principio, justo bajo la barra fija, y no a mitad de página.
    const barra = barraRef.current;
    if (barra && window.scrollY > barra.offsetTop) {
      window.scrollTo({ top: barra.offsetTop, behavior: 'instant' });
    }
  }

  const aplicarPreset = (p: RangoPreset) =>
    actualizar({ rango: p === PRESET_DEFECTO ? null : p, desde: null, hasta: null });
  const aplicarPersonalizado = (d: string, h: string) =>
    actualizar({ rango: 'personalizado', desde: d, hasta: h });

  const dias = diasEntre(desde, hasta);
  const vs = `los ${plural(dias, 'día')} anteriores`;
  const etiqueta = etiquetaRango(desde, hasta);
  const ctx = informe ? { informe, anterior, vs, etiqueta } : null;
  // Un API anterior al bot no manda `bot`: entonces la pestaña no existe.
  const vistas = informe && !informe.bot ? VISTAS.filter((v) => v.key !== 'bots') : VISTAS;
  const vistaVisible = vistas.some((v) => v.key === vista) ? vista : 'resumen';

  const selector = (compacto: boolean) => (
    <SelectorPeriodo
      compacto={compacto}
      preset={preset}
      desde={desde}
      hasta={hasta}
      onPreset={aplicarPreset}
      onPersonalizado={aplicarPersonalizado}
    />
  );

  return (
    // @container: la grilla responde al ancho real del contenido, que cambia
    // con la barra lateral (256px abierta, 72px colapsada), no al de la ventana.
    <div className="@container p-4 sm:p-6 lg:p-8">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 data-titulo-pagina className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
            Informes
          </h1>
          <p className="mt-1 text-sm text-zinc-500 tabular-nums dark:text-zinc-400">
            {/* En teléfono el rango largo ocupaba dos líneas: va el corto. */}
            <span className="@xl:hidden">{rangoCorto(desde, hasta)}</span>
            <span className="hidden @xl:inline">{etiqueta}</span>
            {dias > 1 && <span className="whitespace-nowrap"> · {plural(dias, 'día')}</span>}
          </p>
        </div>
        <div className="shrink-0 @2xl:hidden">{selector(true)}</div>
      </header>

      <div
        ref={barraRef}
        className="sticky top-[61px] z-10 -mx-4 mt-4 border-b border-zinc-200/70 bg-white/80 px-4 py-2.5 backdrop-blur-md sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-8 lg:px-8 dark:border-zinc-800/70 dark:bg-zinc-950/80"
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1 @2xl:flex-none">
            <PestanasInforme vistas={vistas} activa={vistaVisible} onCambiar={cambiarVista} />
          </div>
          <div className="ml-auto hidden @2xl:block">{selector(false)}</div>
        </div>
        {cargando && ctx && (
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-brand-orange/15"
          >
            <span className="btn-gradient absolute inset-y-0 w-1/3 animate-barra-carga" />
          </span>
        )}
      </div>

      {error && <ErrorInforme mensaje={error} onReintentar={reintentar} />}
      {!error && !ctx && <SkeletonInforme />}

      {!error && ctx && (
        // Al cambiar de período el informe anterior queda visible y atenuado
        // hasta que llega el nuevo: sin volver al skeleton ni saltos de scroll.
        <div
          key={vistaVisible}
          {...propsPanel(vistaVisible)}
          aria-busy={cargando}
          className={`animate-entrada-seccion outline-none transition-opacity duration-200 ${cargando ? 'pointer-events-none opacity-50' : ''}`}
        >
          {vistaVisible === 'resumen' && <SeccionResumen {...ctx} />}
          {vistaVisible === 'productos' && <SeccionProductos {...ctx} />}
          {vistaVisible === 'clientes' && <SeccionClientes {...ctx} />}
          {vistaVisible === 'bots' && <SeccionBots {...ctx} />}
        </div>
      )}
    </div>
  );
}
