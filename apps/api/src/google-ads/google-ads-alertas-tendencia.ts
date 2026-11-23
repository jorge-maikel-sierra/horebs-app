import { DIAS_POR_SEMANA } from '../common/tiempo';
import type { AlertaDto } from './google-ads-alertas';
import {
  CLICS_ETIQUETA_ROTA,
  CONVERSIONES_BASE_CPA,
  DIAS_RECIENTES_CPA,
  FACTOR_CPA_ALTO,
  FACTOR_CTR_CAE,
  IMPRESIONES_CTR_RECIENTE,
  IMPRESIONES_QS,
  QS_BAJO,
  type EntradaRendimiento,
} from './google-ads-alertas-rendimiento';
import { dividir, sumar, sumarDias } from './google-ads-metricas';
import { formatoPesos } from './google-ads-formato';

/** Alertas que comparan los últimos días con el resto del período (puras). */

const CATEGORIA_COMPRA = 'PURCHASE';

function partirSerie(
  e: EntradaRendimiento,
  dias: number,
): {
  recientes: EntradaRendimiento['serie'];
  base: EntradaRendimiento['serie'];
} {
  const corte = sumarDias(e.hasta, 1 - dias);
  return {
    recientes: e.serie.filter((p) => p.fecha >= corte),
    base: e.serie.filter((p) => p.fecha < corte),
  };
}

export function alertaCpaAlto(e: EntradaRendimiento): AlertaDto | null {
  const { recientes, base } = partirSerie(e, DIAS_RECIENTES_CPA);
  const b = sumar(base);
  const r = sumar(recientes);
  if (b.conversiones < CONVERSIONES_BASE_CPA) return null;
  const cpaBase = b.gasto / b.conversiones;
  if (r.gasto < cpaBase) return null;
  const cpaReciente = dividir(r.gasto, r.conversiones);
  const alto = cpaReciente === null || cpaReciente > FACTOR_CPA_ALTO * cpaBase;
  if (!alto) return null;
  return {
    codigo: 'CPA_ALTO',
    severidad: 'alta',
    titulo: 'El costo por conversión se disparó',
    detalle: `Últimos 3 días: ${
      cpaReciente === null ? 'sin conversiones' : formatoPesos(cpaReciente)
    } frente a ${formatoPesos(cpaBase)} antes.`,
    accion:
      'Revisar términos nuevos con gasto y si algo cambió en la cuenta o en la web.',
  };
}

export function alertaCtrCae(e: EntradaRendimiento): AlertaDto | null {
  const { recientes, base } = partirSerie(e, DIAS_POR_SEMANA);
  const r = sumar(recientes);
  const b = sumar(base);
  if (r.impresiones < IMPRESIONES_CTR_RECIENTE || b.impresiones === 0) {
    return null;
  }
  const ctrR = r.clics / r.impresiones;
  const ctrB = b.clics / b.impresiones;
  if (ctrR >= FACTOR_CTR_CAE * ctrB) return null;
  return {
    codigo: 'CTR_CAE',
    severidad: 'media',
    titulo: 'Menos gente hace clic en los anuncios',
    detalle: `CTR de los últimos 7 días: ${(ctrR * 100).toFixed(1)}% frente a ${(
      ctrB * 100
    ).toFixed(1)}% antes.`,
    accion:
      'Revisar si entró un competidor o si los términos cambiaron; probar títulos nuevos.',
  };
}

export function alertaQsBajo(e: EntradaRendimiento): AlertaDto | null {
  const bajas = e.palabras.filter(
    (p) =>
      p.qs !== null &&
      p.qs !== undefined &&
      p.qs <= QS_BAJO &&
      p.impresiones >= IMPRESIONES_QS,
  );
  if (bajas.length === 0) return null;
  return {
    codigo: 'QS_BAJO',
    severidad: 'media',
    titulo: 'Palabras con nivel de calidad bajo',
    detalle: bajas.map((p) => `«${p.nombre}» QS ${p.qs}`).join(', '),
    accion:
      'Mirar el componente débil en la tabla: anuncio más parecido a la búsqueda o mejor página de destino.',
  };
}

/** Clics recientes sin ninguna compra, cuando antes sí había: la etiqueta pudo romperse. */
export function alertaEtiquetaRota(e: EntradaRendimiento): AlertaDto | null {
  const corte = sumarDias(e.hasta, 1 - DIAS_RECIENTES_CPA);
  const compras = e.conversiones.filter(
    (c) => c.categoria === CATEGORIA_COMPRA,
  );
  const antes = compras
    .filter((c) => c.fecha < corte)
    .reduce((s, c) => s + Number(c.conversiones), 0);
  const ahora = compras
    .filter((c) => c.fecha >= corte)
    .reduce((s, c) => s + Number(c.conversiones), 0);
  const clics = sumar(e.serie.filter((p) => p.fecha >= corte)).clics;
  if (antes === 0 || ahora > 0 || clics < CLICS_ETIQUETA_ROTA) return null;
  return {
    codigo: 'ETIQUETA_ROTA',
    severidad: 'alta',
    titulo: 'Ninguna compra medida en 3 días',
    detalle: `${clics} clics y 0 "Pedido confirmado", cuando antes sí se medían.`,
    accion:
      'Revisar la etiqueta en Tag Assistant o en la vista previa de GTM antes de cambiar pujas (si se crea un pedido de prueba, cancelarlo).',
  };
}
