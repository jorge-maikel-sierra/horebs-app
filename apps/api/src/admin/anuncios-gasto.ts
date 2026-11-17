/**
 * Gasto de los anuncios cruzado con las ventas: por campaña y en general.
 * Puro, sin Nest. Los pedidos cancelados no suman ventas.
 */
export interface FilaGastoDia {
  anuncio_id: string;
  campana_id: string;
  campana_nombre: string | null;
  fecha: string;
  gasto: number | string;
  impresiones: number;
  alcance: number;
  clics: number;
}

export interface FilaPedidoTablero {
  id: string;
  total: number | string;
  estado: string;
  cliente_id: string | null;
  origen_anuncio_id: string | null;
  origen_campana_id: string | null;
  atribucion_web: { utm_campaign?: string } | null;
}

export interface CampanaRendimientoDto {
  campana_id: string;
  nombre: string;
  gasto: number;
  impresiones: number;
  clics: number;
  pedidos: number;
  ventas: number;
  clientes_nuevos: number;
  /** null mientras no haya pedidos atribuidos a la campaña. */
  costo_por_pedido: number | null;
  costo_por_cliente_nuevo: number | null;
  roas: number | null;
}

export interface ResumenGeneralDto {
  gasto_total: number;
  ventas_totales: number;
  pedidos_totales: number;
  pedidos_atribuidos: number;
  /** Ventas de todos los canales entre el gasto: la cifra completa mientras la atribución sea parcial. */
  roas_general: number | null;
}

export interface CampanaReciente {
  id: string;
  nombre: string;
}

const CENTESIMAS = 100;

function redondear(valor: number): number {
  return Math.round(valor * CENTESIMAS) / CENTESIMAS;
}

function dividir(numerador: number, denominador: number): number | null {
  return denominador > 0 ? redondear(numerador / denominador) : null;
}

interface Indices {
  campanaDeAnuncio: Map<string, string>;
  campanaPorNombre: Map<string, string>;
}

function indices(gasto: FilaGastoDia[]): Indices {
  const campanaDeAnuncio = new Map<string, string>();
  const campanaPorNombre = new Map<string, string>();
  for (const g of gasto) {
    campanaDeAnuncio.set(g.anuncio_id, g.campana_id);
    if (g.campana_nombre) {
      campanaPorNombre.set(g.campana_nombre.trim().toLowerCase(), g.campana_id);
    }
  }
  return { campanaDeAnuncio, campanaPorNombre };
}

/**
 * La campaña de una venta, por orden: la que eligió la caja, el anuncio del
 * bot (que se traduce a su campaña) y el `utm_campaign` de la web.
 */
export function campanaDePedido(
  pedido: FilaPedidoTablero,
  { campanaDeAnuncio, campanaPorNombre }: Indices,
): string | null {
  if (pedido.origen_campana_id) return pedido.origen_campana_id;
  const delAnuncio = pedido.origen_anuncio_id
    ? campanaDeAnuncio.get(pedido.origen_anuncio_id)
    : undefined;
  if (delAnuncio) return delAnuncio;
  const utm = pedido.atribucion_web?.utm_campaign?.trim().toLowerCase();
  return (utm && campanaPorNombre.get(utm)) || null;
}

interface AcumuladoCampana {
  nombre: string;
  gasto: number;
  impresiones: number;
  clics: number;
  pedidos: number;
  ventas: number;
  nuevos: Set<string>;
}

function acumuladoVacio(nombre: string): AcumuladoCampana {
  return {
    nombre,
    gasto: 0,
    impresiones: 0,
    clics: 0,
    pedidos: 0,
    ventas: 0,
    nuevos: new Set(),
  };
}

function acumularGasto(gasto: FilaGastoDia[]): Map<string, AcumuladoCampana> {
  const campanas = new Map<string, AcumuladoCampana>();
  for (const g of gasto) {
    const actual =
      campanas.get(g.campana_id) ??
      acumuladoVacio(g.campana_nombre ?? g.campana_id);
    actual.gasto += Number(g.gasto);
    actual.impresiones += g.impresiones;
    actual.clics += g.clics;
    campanas.set(g.campana_id, actual);
  }
  return campanas;
}

/** Cada campaña con su gasto, sus pedidos atribuidos y lo que cuesta cada uno; de más a menos gasto. */
export function rendimientoPorCampana(
  gasto: FilaGastoDia[],
  pedidos: FilaPedidoTablero[],
  clientesNuevos: Set<string>,
): CampanaRendimientoDto[] {
  const campanas = acumularGasto(gasto);
  const idx = indices(gasto);
  for (const p of pedidos) {
    const campana = campanaDePedido(p, idx);
    const fila = campana ? campanas.get(campana) : undefined;
    if (!fila || p.estado === 'cancelado') continue;
    fila.pedidos += 1;
    fila.ventas += Number(p.total);
    if (p.cliente_id && clientesNuevos.has(p.cliente_id)) {
      fila.nuevos.add(p.cliente_id);
    }
  }
  return [...campanas.entries()]
    .map(([id, c]) => ({
      campana_id: id,
      nombre: c.nombre,
      gasto: redondear(c.gasto),
      impresiones: c.impresiones,
      clics: c.clics,
      pedidos: c.pedidos,
      ventas: c.ventas,
      clientes_nuevos: c.nuevos.size,
      costo_por_pedido: dividir(c.gasto, c.pedidos),
      costo_por_cliente_nuevo: dividir(c.gasto, c.nuevos.size),
      roas: dividir(c.ventas, c.gasto),
    }))
    .sort((a, b) => b.gasto - a.gasto);
}

export function resumenGeneral(
  gasto: FilaGastoDia[],
  pedidos: FilaPedidoTablero[],
): ResumenGeneralDto {
  const idx = indices(gasto);
  const vigentes = pedidos.filter((p) => p.estado !== 'cancelado');
  const gastoTotal = gasto.reduce((s, g) => s + Number(g.gasto), 0);
  const ventas = vigentes.reduce((s, p) => s + Number(p.total), 0);
  return {
    gasto_total: redondear(gastoTotal),
    ventas_totales: ventas,
    pedidos_totales: vigentes.length,
    pedidos_atribuidos: vigentes.filter((p) => campanaDePedido(p, idx)).length,
    roas_general: dividir(ventas, gastoTotal),
  };
}

/** Campañas con gasto en el período, para el selector de la caja; las de más gasto primero. */
export function campanasRecientes(gasto: FilaGastoDia[]): CampanaReciente[] {
  return rendimientoPorCampana(gasto, [], new Set()).map((c) => ({
    id: c.campana_id,
    nombre: c.nombre,
  }));
}
