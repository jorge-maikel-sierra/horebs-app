import {
  redondearUno,
  resumenRentabilidad,
  utilidadDePedido,
  type FilaItemCosto,
} from './rentabilidad';

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
  frecuencia: number | string;
  conversaciones: number;
  clics_enlace: number;
}

export interface FilaCreativo {
  anuncio_id: string;
  nombre: string | null;
  estado: string | null;
  miniatura_url: string | null;
  titulo: string | null;
  texto: string | null;
}

export interface FilaPedidoTablero {
  id: string;
  total: number | string;
  estado: string;
  cliente_id: string | null;
  origen_anuncio_id: string | null;
  origen_campana_id: string | null;
  atribucion_web: { utm_campaign?: string } | null;
  items_pedido: FilaItemCosto[] | null;
}

export interface CampanaRendimientoDto {
  campana_id: string;
  nombre: string;
  gasto: number;
  impresiones: number;
  clics: number;
  conversaciones: number;
  /** Gasto entre conversaciones iniciadas que cuenta Meta (incluye las del WhatsApp del local). */
  costo_por_conversacion: number | null;
  /** Promedio ponderado por impresiones: la frecuencia real no se puede sumar entre días. */
  frecuencia: number | null;
  pedidos: number;
  ventas: number;
  clientes_nuevos: number;
  /** null mientras no haya pedidos atribuidos a la campaña. */
  costo_por_pedido: number | null;
  costo_por_cliente_nuevo: number | null;
  roas: number | null;
  /** Ventas de productos menos su costo, en los pedidos atribuidos con costo completo. */
  utilidad_bruta: number;
  /** Qué parte de las ventas atribuidas ya tiene costo cargado; sin eso la utilidad no es confiable. */
  cobertura_costos: number | null;
  /** Utilidad bruta entre gasto: lo que deja cada peso invertido. */
  retorno_utilidad: number | null;
}

export interface ResumenGeneralDto {
  gasto_total: number;
  ventas_totales: number;
  pedidos_totales: number;
  pedidos_atribuidos: number;
  /** Ventas de todos los canales entre el gasto: la cifra completa mientras la atribución sea parcial. */
  roas_general: number | null;
  utilidad_bruta: number;
  margen_pct: number | null;
  cobertura_costos: number | null;
  /** Utilidad bruta menos el gasto en anuncios; null mientras no haya costos cargados. */
  utilidad_tras_anuncios: number | null;
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
  conversaciones: number;
  frecuenciaPorImpresion: number;
  pedidos: number;
  ventas: number;
  ventasProductos: number;
  ventasConCosto: number;
  utilidad: number;
  nuevos: Set<string>;
}

function acumuladoVacio(nombre: string): AcumuladoCampana {
  return {
    nombre,
    gasto: 0,
    impresiones: 0,
    clics: 0,
    conversaciones: 0,
    frecuenciaPorImpresion: 0,
    pedidos: 0,
    ventas: 0,
    ventasProductos: 0,
    ventasConCosto: 0,
    utilidad: 0,
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
    actual.conversaciones += g.conversaciones;
    actual.frecuenciaPorImpresion += Number(g.frecuencia) * g.impresiones;
    campanas.set(g.campana_id, actual);
  }
  return campanas;
}

function sumarPedido(
  fila: AcumuladoCampana,
  p: FilaPedidoTablero,
  clientesNuevos: Set<string>,
): void {
  fila.pedidos += 1;
  fila.ventas += Number(p.total);
  const u = utilidadDePedido(p.items_pedido);
  if (u) {
    fila.ventasProductos += u.ventas;
    if (u.completo) {
      fila.ventasConCosto += u.ventas;
      fila.utilidad += u.utilidad;
    }
  }
  if (p.cliente_id && clientesNuevos.has(p.cliente_id)) {
    fila.nuevos.add(p.cliente_id);
  }
}

function campanaDto(id: string, c: AcumuladoCampana): CampanaRendimientoDto {
  return {
    campana_id: id,
    nombre: c.nombre,
    gasto: redondear(c.gasto),
    impresiones: c.impresiones,
    clics: c.clics,
    conversaciones: c.conversaciones,
    costo_por_conversacion: dividir(c.gasto, c.conversaciones),
    frecuencia: dividir(c.frecuenciaPorImpresion, c.impresiones),
    pedidos: c.pedidos,
    ventas: c.ventas,
    clientes_nuevos: c.nuevos.size,
    costo_por_pedido: dividir(c.gasto, c.pedidos),
    costo_por_cliente_nuevo: dividir(c.gasto, c.nuevos.size),
    roas: dividir(c.ventas, c.gasto),
    utilidad_bruta: c.utilidad,
    cobertura_costos: dividir(c.ventasConCosto * CENTESIMAS, c.ventasProductos),
    retorno_utilidad:
      c.ventasConCosto > 0 ? dividir(c.utilidad, c.gasto) : null,
  };
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
    sumarPedido(fila, p, clientesNuevos);
  }
  return [...campanas.entries()]
    .map(([id, c]) => campanaDto(id, c))
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
  const rentabilidad = resumenRentabilidad(vigentes);
  return {
    gasto_total: redondear(gastoTotal),
    ventas_totales: ventas,
    pedidos_totales: vigentes.length,
    pedidos_atribuidos: vigentes.filter((p) => campanaDePedido(p, idx)).length,
    roas_general: dividir(ventas, gastoTotal),
    utilidad_bruta: rentabilidad.utilidad_bruta,
    margen_pct: rentabilidad.margen_pct,
    cobertura_costos: rentabilidad.cobertura_costos,
    utilidad_tras_anuncios:
      rentabilidad.ventas_con_costo > 0
        ? redondearUno(rentabilidad.utilidad_bruta - gastoTotal)
        : null,
  };
}

/** Campañas con gasto en el período, para el selector de la caja; las de más gasto primero. */
export function campanasRecientes(gasto: FilaGastoDia[]): CampanaReciente[] {
  return rendimientoPorCampana(gasto, [], new Set()).map((c) => ({
    id: c.campana_id,
    nombre: c.nombre,
  }));
}

export interface AnuncioRendimientoDto {
  anuncio_id: string;
  nombre: string;
  estado: string | null;
  miniatura_url: string | null;
  titulo: string | null;
  campana: string;
  gasto: number;
  impresiones: number;
  clics_enlace: number;
  /** Clics en el enlace entre impresiones, en porcentaje. */
  ctr: number | null;
  conversaciones: number;
  costo_por_conversacion: number | null;
  frecuencia: number | null;
  /** Pedidos del bot que llegaron por este anuncio (los de caja se atribuyen a la campaña). */
  pedidos: number;
}

interface AcumuladoAnuncio {
  campana: string;
  nombre: string;
  gasto: number;
  impresiones: number;
  clicsEnlace: number;
  conversaciones: number;
  frecuenciaPorImpresion: number;
}

function acumularAnuncios(
  gasto: FilaGastoDia[],
): Map<string, AcumuladoAnuncio> {
  const anuncios = new Map<string, AcumuladoAnuncio>();
  for (const g of gasto) {
    const actual = anuncios.get(g.anuncio_id) ?? {
      campana: g.campana_nombre ?? g.campana_id,
      nombre: g.anuncio_id,
      gasto: 0,
      impresiones: 0,
      clicsEnlace: 0,
      conversaciones: 0,
      frecuenciaPorImpresion: 0,
    };
    actual.gasto += Number(g.gasto);
    actual.impresiones += g.impresiones;
    actual.clicsEnlace += g.clics_enlace;
    actual.conversaciones += g.conversaciones;
    actual.frecuenciaPorImpresion += Number(g.frecuencia) * g.impresiones;
    anuncios.set(g.anuncio_id, actual);
  }
  return anuncios;
}

/** Cada anuncio con su creativo, lo que gastó y lo que costó cada conversación; de más a menos gasto. */
export function rendimientoPorAnuncio(
  gasto: FilaGastoDia[],
  creativos: FilaCreativo[],
  pedidos: FilaPedidoTablero[],
): AnuncioRendimientoDto[] {
  const porCreativo = new Map(creativos.map((c) => [c.anuncio_id, c]));
  const pedidosPorAnuncio = new Map<string, number>();
  for (const p of pedidos) {
    if (!p.origen_anuncio_id || p.estado === 'cancelado') continue;
    pedidosPorAnuncio.set(
      p.origen_anuncio_id,
      (pedidosPorAnuncio.get(p.origen_anuncio_id) ?? 0) + 1,
    );
  }
  return [...acumularAnuncios(gasto).entries()]
    .map(([id, a]) => {
      const creativo = porCreativo.get(id);
      return {
        anuncio_id: id,
        nombre: creativo?.nombre ?? a.nombre,
        estado: creativo?.estado ?? null,
        miniatura_url: creativo?.miniatura_url ?? null,
        titulo: creativo?.titulo ?? null,
        campana: a.campana,
        gasto: redondear(a.gasto),
        impresiones: a.impresiones,
        clics_enlace: a.clicsEnlace,
        ctr: dividir(a.clicsEnlace * CENTESIMAS, a.impresiones),
        conversaciones: a.conversaciones,
        costo_por_conversacion: dividir(a.gasto, a.conversaciones),
        frecuencia: dividir(a.frecuenciaPorImpresion, a.impresiones),
        pedidos: pedidosPorAnuncio.get(id) ?? 0,
      };
    })
    .sort((a, b) => b.gasto - a.gasto);
}
