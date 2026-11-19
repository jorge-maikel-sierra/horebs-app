'use client';

import { useState } from 'react';
import ErrorInforme from '@/components/informes/ErrorInforme';
import SkeletonInforme from '@/components/informes/SkeletonInforme';
import FiltroPeriodo from '@/components/informes/FiltroPeriodo';
import SeccionBots from '@/components/informes/secciones/SeccionBots';
import SeccionClientes from '@/components/informes/secciones/SeccionClientes';
import SeccionProductos from '@/components/informes/secciones/SeccionProductos';
import SeccionResumen from '@/components/informes/secciones/SeccionResumen';
import { useInforme } from '@/components/informes/use-informe';
import {
  PRESETS_INFORME,
  calcularRango,
  diasEntre,
  etiquetaRango,
  type RangoPreset,
} from '@/lib/informes-rango';

export default function InformesVista() {
  const [preset, setPreset] = useState<RangoPreset>('7dias');
  const [rango, setRango] = useState(() => calcularRango('7dias'));
  const { desde, hasta } = rango;
  const { informe, anterior, cargando, error, reintentar } = useInforme(desde, hasta);

  function aplicarPreset(p: RangoPreset) {
    setPreset(p);
    if (p !== 'personalizado') setRango(calcularRango(p));
  }

  function aplicarPersonalizado(d: string, h: string) {
    setPreset('personalizado');
    setRango({ desde: d, hasta: h });
  }

  const dias = diasEntre(desde, hasta);
  const vs = `los ${dias} ${dias === 1 ? 'día' : 'días'} anteriores`;
  const etiqueta = etiquetaRango(desde, hasta);
  const ctx = informe ? { informe, anterior, vs, etiqueta } : null;

  return (
    // @container: la grilla responde al ancho real del contenido, que cambia
    // con la barra lateral (256px abierta, 72px colapsada), no al de la ventana.
    <div className="@container p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Informes</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Métricas de ventas del negocio — web y mostrador.
          </p>
        </div>
        {etiqueta && (
          <p className="rounded-full border border-zinc-200 bg-white/70 px-3 py-1 text-xs font-semibold text-zinc-600 tabular-nums dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
            {etiqueta}
            {dias > 1 && ` · ${dias} días`}
          </p>
        )}
      </header>

      <div className="sticky top-[61px] z-10 -mx-4 mt-4 border-b border-zinc-200/70 bg-white/80 px-4 py-2.5 backdrop-blur-md sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-8 lg:px-8 dark:border-zinc-800/70 dark:bg-zinc-950/80">
        <FiltroPeriodo
          presets={PRESETS_INFORME}
          activo={preset}
          personalizadoKey="personalizado"
          desde={desde}
          hasta={hasta}
          onPreset={aplicarPreset}
          onRangoPersonalizado={aplicarPersonalizado}
        />
      </div>

      {error && <ErrorInforme mensaje={error} onReintentar={reintentar} />}
      {!error && !ctx && <SkeletonInforme />}

      {!error && ctx && (
        // Al cambiar de período el informe anterior queda visible y atenuado
        // hasta que llega el nuevo: sin volver al skeleton ni saltos de scroll.
        <div
          aria-busy={cargando}
          className={`transition-opacity duration-200 ${cargando ? 'pointer-events-none opacity-50' : ''}`}
        >
          <SeccionResumen {...ctx} />
          <SeccionProductos {...ctx} />
          <SeccionClientes {...ctx} />
          <SeccionBots {...ctx} />
        </div>
      )}
    </div>
  );
}
