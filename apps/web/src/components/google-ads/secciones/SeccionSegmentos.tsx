'use client';

import BarraParticipacion, { type SegmentoParticipacion } from '@/components/informes/BarraParticipacion';
import Panel from '@/components/informes/Panel';
import MapaCalorHoras from '@/components/google-ads/MapaCalorHoras';
import { etiqueta, fechaCorta, numero, pct, pesos, type TableroAds } from '@/components/google-ads/google-ads.tipos';
import { formatPrecio } from '@/lib/formato';

const HORA_LIMITE = 21;

export default function SeccionSegmentos({ t }: { t: TableroAds }) {
  const dispositivos: SegmentoParticipacion[] = t.dispositivos.map((d, i) => ({
    clave: d.clave,
    etiqueta: etiqueta(d.clave),
    valor: d.gasto,
    detalle: `${formatPrecio(d.gasto)} · ${d.clics} clics · CPA ${pesos(d.cpa)}`,
    slot: i,
  }));
  const ciudades: SegmentoParticipacion[] = t.geo.ciudades.map((c, i) => ({
    clave: `${c.tipo}:${c.nombre}`,
    etiqueta: c.tipo === 'interes' ? `${c.nombre} (por interés)` : c.nombre,
    valor: c.gasto,
    detalle: `${formatPrecio(c.gasto)} · ${c.clics} clics · ${numero(c.conversiones)} conv.`,
    slot: i,
  }));
  const tempranos = t.agotamiento.filter((a) => a.hora < HORA_LIMITE);
  return (
    <div className="mt-6 space-y-6">
      <Panel titulo="Gasto por día y hora" subtitulo="Hora de Bogotá, período seleccionado">
        <MapaCalorHoras celdas={t.horas} />
        {tempranos.length > 0 && (
          <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
            El presupuesto se agotó antes de las 9 p.m. en {tempranos.length} día(s):{' '}
            {tempranos.map((a) => `${fechaCorta(a.fecha)} (${a.hora}:00)`).join(', ')}.
          </p>
        )}
      </Panel>
      <div className="grid gap-6 @4xl:grid-cols-2">
        <Panel
          titulo="Zona"
          subtitulo={`Fuera de Riohacha o por interés: ${pct(t.geo.fuera_zona)} del gasto`}
        >
          <BarraParticipacion segmentos={ciudades} vacio="Sin datos de ubicación en este período." />
        </Panel>
        <Panel titulo="Dispositivo" subtitulo="Con poco volumen el CPA por dispositivo es orientativo">
          <BarraParticipacion segmentos={dispositivos} vacio="Sin datos de dispositivo en este período." />
        </Panel>
      </div>
    </div>
  );
}
