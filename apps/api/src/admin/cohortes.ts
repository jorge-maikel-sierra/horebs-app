/**
 * Cohortes de recompra: cuántos clientes vuelven a comprar y a los cuántos días,
 * por mes de su primera compra y por la campaña que trajo esa primera compra.
 * Puro, sin Nest. Los pedidos cancelados no cuentan.
 */
import { MS_POR_DIA } from '../common/tiempo';

export interface PedidoCohorte {
  cliente_id: string | null;
  total: number | string;
  estado: string;
  created_at: string;
  /** Campaña a la que se atribuyó el pedido; null si no se pudo atribuir. */
  campana_id: string | null;
}

export interface VentanaRecompra {
  dias: number;
  /** Clientes cuya primera compra tiene al menos `dias` días: los únicos que ya pudieron volver. */
  elegibles: number;
  recompraron: number;
  pct: number | null;
}

export interface MetricasCohorte {
  clientes: number;
  pedidos: number;
  /** Lo que han pagado esos clientes hasta hoy, en todos sus pedidos. */
  valor: number;
  pedidos_por_cliente: number | null;
  recompra: VentanaRecompra[];
  /** Mediana de días entre la primera y la segunda compra, de quienes ya repitieron. */
  dias_a_segunda: number | null;
}

export interface CohorteMesDto extends MetricasCohorte {
  mes: string;
}

export interface CohorteCampanaDto extends MetricasCohorte {
  campana_id: string;
  nombre: string;
  gasto: number;
  /** Gasto entre clientes nuevos que trajo la campaña. */
  costo_por_cliente_nuevo: number | null;
  /** Lo que han pagado esos clientes entre el gasto de la campaña. */
  valor_sobre_gasto: number | null;
}

export interface GastoCampana {
  nombre: string;
  gasto: number;
}

const DIAS_UN_MES = 30;
const DIAS_DOS_MESES = 60;
const DIAS_TRES_MESES = 90;
const VENTANAS_DIAS = [DIAS_UN_MES, DIAS_DOS_MESES, DIAS_TRES_MESES];
const MESES_MOSTRADOS = 12;
const CIEN = 100;
const DECIMALES = 10;
const MITAD = 2;
const LARGO_MES = 7;

function redondear(valor: number): number {
  return Math.round(valor * DECIMALES) / DECIMALES;
}

function diasEntre(desde: number, hasta: number): number {
  return (hasta - desde) / MS_POR_DIA;
}

/** Mes (AAAA-MM) en hora de Bogotá, no en UTC. */
export function mesBogota(fecha: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' })
    .format(new Date(fecha))
    .slice(0, LARGO_MES);
}

/** Pedidos vigentes de cada cliente, del primero al último. */
export function historiales(
  pedidos: PedidoCohorte[],
): Map<string, PedidoCohorte[]> {
  const mapa = new Map<string, PedidoCohorte[]>();
  for (const p of pedidos) {
    if (!p.cliente_id || p.estado === 'cancelado') continue;
    const lista = mapa.get(p.cliente_id) ?? [];
    lista.push(p);
    mapa.set(p.cliente_id, lista);
  }
  for (const lista of mapa.values()) {
    lista.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  return mapa;
}

function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / MITAD);
  const centro = orden.at(medio) ?? 0;
  return orden.length % MITAD === 1
    ? centro
    : ((orden.at(medio - 1) ?? 0) + centro) / MITAD;
}

function ventana(
  dias: number,
  clientes: PedidoCohorte[][],
  ahora: number,
): VentanaRecompra {
  const elegibles = clientes.filter(
    (c) => diasEntre(Date.parse(c[0].created_at), ahora) >= dias,
  );
  const recompraron = elegibles.filter(
    (c) =>
      c.length > 1 &&
      diasEntre(Date.parse(c[0].created_at), Date.parse(c[1].created_at)) <=
        dias,
  ).length;
  return {
    dias,
    elegibles: elegibles.length,
    recompraron,
    pct:
      elegibles.length > 0
        ? redondear((recompraron / elegibles.length) * CIEN)
        : null,
  };
}

/** Métricas de un grupo de clientes, cada uno con su historial ya ordenado. */
export function metricasDeCohorte(
  clientes: PedidoCohorte[][],
  ahora: Date,
): MetricasCohorte {
  const pedidos = clientes.reduce((s, c) => s + c.length, 0);
  const valor = clientes.reduce(
    (s, c) => s + c.reduce((t, p) => t + Number(p.total), 0),
    0,
  );
  const hastaSegunda = clientes
    .filter((c) => c.length > 1)
    .map((c) =>
      diasEntre(Date.parse(c[0].created_at), Date.parse(c[1].created_at)),
    );
  const dias = mediana(hastaSegunda);
  return {
    clientes: clientes.length,
    pedidos,
    valor,
    pedidos_por_cliente:
      clientes.length > 0 ? redondear(pedidos / clientes.length) : null,
    recompra: VENTANAS_DIAS.map((d) => ventana(d, clientes, ahora.getTime())),
    dias_a_segunda: dias === null ? null : redondear(dias),
  };
}

/** Un renglón por mes de primera compra (los últimos 12), del más reciente al más viejo. */
export function cohortesPorMes(
  pedidos: PedidoCohorte[],
  ahora: Date,
): CohorteMesDto[] {
  const grupos = new Map<string, PedidoCohorte[][]>();
  for (const historial of historiales(pedidos).values()) {
    const mes = mesBogota(historial[0].created_at);
    grupos.set(mes, [...(grupos.get(mes) ?? []), historial]);
  }
  return [...grupos.entries()]
    .map(([mes, clientes]) => ({ mes, ...metricasDeCohorte(clientes, ahora) }))
    .sort((a, b) => b.mes.localeCompare(a.mes))
    .slice(0, MESES_MOSTRADOS);
}

/**
 * Clientes nuevos desde `desde` agrupados por la campaña de su primera compra.
 * Solo entran los que se pudieron atribuir; el resto va en `sin_atribuir`.
 */
export function cohortesPorCampana(
  pedidos: PedidoCohorte[],
  opciones: {
    gasto: Map<string, GastoCampana>;
    desde: string;
    /** Clientes creados en el período: un cliente que ya existía no es nuevo aunque pida ahora. */
    nuevosIds: Set<string>;
    ahora: Date;
  },
): { campanas: CohorteCampanaDto[]; nuevos: number; atribuidos: number } {
  const { gasto, desde, nuevosIds, ahora } = opciones;
  const grupos = new Map<string, PedidoCohorte[][]>();
  let nuevos = 0;
  let atribuidos = 0;
  for (const [clienteId, historial] of historiales(pedidos)) {
    const primero = historial[0];
    if (primero.created_at < desde || !nuevosIds.has(clienteId)) continue;
    nuevos += 1;
    if (!primero.campana_id) continue;
    atribuidos += 1;
    grupos.set(primero.campana_id, [
      ...(grupos.get(primero.campana_id) ?? []),
      historial,
    ]);
  }
  const campanas = [...grupos.entries()]
    .map(([id, clientes]) => {
      const g = gasto.get(id);
      const m = metricasDeCohorte(clientes, ahora);
      return {
        campana_id: id,
        nombre: g?.nombre ?? id,
        gasto: redondear(g?.gasto ?? 0),
        ...m,
        costo_por_cliente_nuevo:
          g && m.clientes > 0 ? redondear(g.gasto / m.clientes) : null,
        valor_sobre_gasto:
          g && g.gasto > 0 ? redondear(m.valor / g.gasto) : null,
      };
    })
    .sort((a, b) => b.clientes - a.clientes);
  return { campanas, nuevos, atribuidos };
}
