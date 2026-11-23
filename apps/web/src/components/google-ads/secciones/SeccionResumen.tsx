'use client';

import GraficoColumnas, { type PuntoColumna } from '@/components/informes/GraficoColumnas';
import Panel from '@/components/informes/Panel';
import { TarjetaKpi } from '@/components/informes/TarjetasResumen';
import { IconChat, IconMoneda, IconPedidos, IconPorcentaje, IconTendencia, IconTicket } from '@/components/informes/iconos';
import PanelAlertas from '@/components/google-ads/PanelAlertas';
import {
  etiqueta,
  fechaCorta,
  numero,
  pct,
  pesos,
  veces,
  type PuntoSerie,
  type TableroAds,
} from '@/components/google-ads/google-ads.tipos';
import { calcularDelta, type Delta } from '@/lib/informes-rango';
import { formatPrecio } from '@/lib/formato';

const VS = 'el período anterior';

function delta(actual: number | null, anterior: number | null): Delta | null {
  if (actual === null || anterior === null) return null;
  return calcularDelta(actual, anterior);
}

function puntos(serie: PuntoSerie[], valor: (p: PuntoSerie) => number, detalle: (p: PuntoSerie) => string): PuntoColumna[] {
  return serie.map((p) => ({
    clave: p.fecha,
    etiqueta: fechaCorta(p.fecha),
    etiquetaLarga: fechaCorta(p.fecha),
    valor: valor(p),
    detalle: detalle(p),
  }));
}

function Kpis({ t }: { t: TableroAds }) {
  const r = t.resumen;
  const a = t.resumen_anterior;
  const n = t.negocio;
  const serie = (f: (p: PuntoSerie) => number) => t.serie.map(f);
  const insuficiente = 'Muestra insuficiente';
  return (
    <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-3 @6xl:grid-cols-6">
      <TarjetaKpi
        icono={<IconMoneda />}
        label="Gasto Google"
        valor={formatPrecio(r.gasto)}
        detalle={`Antes: ${formatPrecio(a.gasto)}`}
        serie={serie((p) => p.gasto)}
      />
      <TarjetaKpi
        icono={<IconPedidos />}
        label="Conversiones Ads"
        valor={numero(r.conversiones)}
        detalle={`${r.clics} clics · ${r.llamadas} llamadas`}
        delta={delta(r.conversiones, a.conversiones)}
        vs={VS}
        serie={serie((p) => p.conversiones)}
        tono="azul"
      />
      <TarjetaKpi
        icono={<IconTicket />}
        label="Costo por conversión"
        valor={pesos(r.cpa)}
        detalle={r.muestra.cpa ? 'Según Google' : `${insuficiente} (< ${t.muestra_minima.conversiones_cpa} conv.)`}
        delta={r.muestra.cpa ? delta(r.cpa, a.cpa) : null}
        vs={VS}
        sentido="menos_es_mejor"
      />
      <TarjetaKpi
        icono={<IconTendencia />}
        label="Retorno combinado"
        valor={veces(n.roas_combinado)}
        detalle="Ventas ÷ gasto Google + Meta"
        delta={delta(n.roas_combinado, t.negocio_anterior.roas_combinado)}
        vs={VS}
        tono="verde"
      />
      <TarjetaKpi
        icono={<IconPorcentaje />}
        label="Cuota de impresiones"
        valor={`${r.cuota.acotada_inferior ? '< ' : ''}${pct(r.cuota.busqueda)}`}
        detalle={`Perdida: ${pct(r.cuota.perdida_presupuesto)} presupuesto · ${pct(r.cuota.perdida_ranking)} ranking`}
        delta={delta(r.cuota.busqueda, a.cuota.busqueda)}
        vs={VS}
        tono="amarillo"
      />
      <TarjetaKpi
        icono={<IconChat />}
        label="Pedidos con origen"
        valor={pct(n.cobertura)}
        detalle={`${n.pedidos_google} de ${n.pedidos} pedidos vinieron de Google`}
        tono="azul"
      />
    </div>
  );
}

function Ritmo({ t }: { t: TableroAds }) {
  const r = t.ritmo;
  const ancho = Math.min(100, Math.max(0, (r.ritmo ?? 0) * 100));
  const pasa = (r.ritmo ?? 0) > 1.05;
  return (
    <Panel titulo="Ritmo del mes" subtitulo={`${r.dias_transcurridos} de ${r.dias_mes} días · presupuesto ${formatPrecio(r.presupuesto_diario)}/día`}>
      <p className="text-2xl font-extrabold text-zinc-900 tabular-nums dark:text-zinc-50">
        {formatPrecio(r.gasto_mes)}
        <span className="ml-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
          de {formatPrecio(r.presupuesto_mes)} (30,4 × diario)
        </span>
      </p>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
        role="progressbar"
        aria-valuenow={Math.round(ancho)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Proyección del gasto del mes frente al presupuesto"
      >
        <div className={`h-full rounded-full ${pasa ? 'bg-red-600' : 'btn-gradient'}`} style={{ width: `${ancho}%` }} />
      </div>
      <p className={`mt-2 text-sm ${pasa ? 'text-red-600 dark:text-red-400' : 'text-zinc-600 dark:text-zinc-400'}`}>
        A este ritmo el mes cierra en {pesos(r.proyeccion)} ({pct(r.ritmo)} del presupuesto).
      </p>
    </Panel>
  );
}

function Negocio({ t }: { t: TableroAds }) {
  const n = t.negocio;
  const filas: [string, string, string?][] = [
    ['Pedidos del período', String(n.pedidos)],
    ['Ventas', formatPrecio(n.ventas)],
    ['Gasto Google + Meta', `${formatPrecio(n.gasto_google)} + ${formatPrecio(n.gasto_meta)}`],
    ['Costo por pedido (combinado)', pesos(n.cpa_combinado)],
    ['Costo por cliente nuevo', pesos(n.cac_combinado), `${n.clientes_nuevos} clientes nuevos`],
    ['Pedidos atribuidos a Google', String(n.pedidos_google), formatPrecio(n.ventas_google)],
    [
      'Costo por pedido de Google',
      pesos(n.cpa_google),
      n.cota_inferior ? 'Cota: pocos pedidos traen origen, el real es menor' : undefined,
    ],
  ];
  return (
    <Panel titulo="Negocio real" subtitulo="Pedidos de la base cruzados con el gasto en anuncios">
      <dl className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {filas.map(([k, v, nota]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 py-2">
            <dt className="text-sm text-zinc-600 dark:text-zinc-400">
              {k}
              {nota && <span className="block text-xs text-zinc-500 dark:text-zinc-500">{nota}</span>}
            </dt>
            <dd className="text-right font-semibold text-zinc-900 tabular-nums dark:text-zinc-50">{v}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function Conversiones({ t }: { t: TableroAds }) {
  return (
    <Panel titulo="Conversiones por acción" subtitulo="Nunca se suman: un clic a WhatsApp no es una venta">
      {t.conversiones.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Sin conversiones en este período.</p>
      ) : (
        <ul className="space-y-2">
          {t.conversiones.map((c) => (
            <li key={c.accion} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 text-sm text-zinc-700 dark:text-zinc-300">{c.accion}</span>
              <span className="shrink-0 text-right text-sm tabular-nums">
                <strong className="text-zinc-900 dark:text-zinc-50">{numero(c.conversiones)}</strong>
                <span className="ml-2 text-zinc-500 dark:text-zinc-400">antes {numero(c.conversiones_anterior)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Cambios({ t }: { t: TableroAds }) {
  return (
    <Panel titulo="Cambios en la cuenta" subtitulo="Qué se tocó en Google Ads en el período: explica saltos en la tendencia">
      {t.cambios.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Sin cambios registrados en este período.</p>
      ) : (
        <ul className="space-y-2">
          {t.cambios.map((c) => (
            <li key={c.recurso_cambio} className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="shrink-0 font-semibold text-zinc-900 tabular-nums dark:text-zinc-50">
                {fechaCorta(c.fecha)} {c.momento.slice(11, 16)}
              </span>
              <span className="text-zinc-700 dark:text-zinc-300">
                {etiqueta(c.operacion)} · {etiqueta(c.tipo_recurso)}
              </span>
              {c.campos.length > 0 && (
                <span className="[overflow-wrap:anywhere] text-xs text-zinc-500 dark:text-zinc-400">{c.campos.join(', ')}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Campanas({ t }: { t: TableroAds }) {
  return (
    <Panel titulo="Campañas" subtitulo="Estado y estrategia de puja al último día con datos">
      <ul className="space-y-3">
        {t.campanas.map((c) => (
          <li key={c.campana_id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">{c.nombre}</span>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {etiqueta(c.estado_principal)} · {etiqueta(c.estrategia_puja)}
              {c.estado_puja ? ` (${etiqueta(c.estado_puja)})` : ''} · {formatPrecio(c.gasto)} · CPC {pesos(c.cpc)}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export default function SeccionResumen({ t }: { t: TableroAds }) {
  const cambiosPorDia = new Map<string, number>();
  for (const c of t.cambios) cambiosPorDia.set(c.fecha, (cambiosPorDia.get(c.fecha) ?? 0) + 1);
  const notaCambios = (fecha: string) => {
    const n = cambiosPorDia.get(fecha);
    return n ? ` · ${n} cambio(s) en la cuenta` : '';
  };
  return (
    <div className="mt-6 space-y-6">
      <Kpis t={t} />
      <section aria-labelledby="titulo-alertas">
        <h2 id="titulo-alertas" className="mb-3 text-base font-bold text-zinc-900 dark:text-zinc-50">
          Alertas
        </h2>
        <PanelAlertas alertas={t.alertas} />
      </section>
      <div className="grid gap-6 @5xl:grid-cols-2">
        <Panel titulo="Gasto por día" subtitulo="Pesos, según Google Ads">
          <GraficoColumnas
            puntos={puntos(t.serie, (p) => p.gasto, (p) => `${formatPrecio(p.gasto)} · ${p.clics} clics${notaCambios(p.fecha)}`)}
            tono="naranja"
            nombreValor="Gasto"
            formatoValor={formatPrecio}
            formatoEje={(v) => `$${Math.round(v / 1000)}k`}
          />
        </Panel>
        <Panel titulo="Conversiones por día" subtitulo="Todas las acciones de Google Ads">
          <GraficoColumnas
            puntos={puntos(t.serie, (p) => p.conversiones, (p) => `${numero(p.conversiones)} conversiones`)}
            tono="azul"
            nombreValor="Conversiones"
            formatoValor={(v) => numero(v)}
            formatoEje={(v) => numero(v)}
          />
        </Panel>
      </div>
      <div className="grid gap-6 @5xl:grid-cols-3">
        <Negocio t={t} />
        <div className="space-y-6">
          <Ritmo t={t} />
          <Conversiones t={t} />
        </div>
        <div className="space-y-6">
          <Campanas t={t} />
          <Cambios t={t} />
        </div>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        ⓘ Google ajusta las conversiones de los últimos días (el script reenvía 7 días cada mañana) y algunas son
        modeladas. La mayoría de los pedidos se cierran por WhatsApp sin origen: el costo por conversión de Google
        exagera el costo real. Solo se compara contra el período anterior, nunca contra promedios de la industria.
      </p>
    </div>
  );
}
