import { claveBucket } from './informes-fechas';
import type {
  Acumulador,
  Granularidad,
  InformeDesgloseDto,
  InformeDto,
  PedidoBotFila,
  PedidoUnificado,
  TotalesPedidos,
} from './informes.tipos';

export function acumular(
  mapa: Map<string, Acumulador>,
  clave: string,
  monto: number,
): void {
  const actual = mapa.get(clave) ?? { total: 0, pedidos: 0 };
  actual.total += monto;
  actual.pedidos += 1;
  mapa.set(clave, actual);
}

export function acumularProducto(
  mapa: Map<string, { cantidad: number; total: number }>,
  clave: string,
  cantidad: number,
  total: number,
): void {
  const actual = mapa.get(clave) ?? { cantidad: 0, total: 0 };
  actual.cantidad += cantidad;
  actual.total += total;
  mapa.set(clave, actual);
}

export function serializarMapa(
  mapa: Map<string, Acumulador>,
): InformeDesgloseDto[] {
  return [...mapa.entries()]
    .map(([clave, v]) => ({ clave, ...v }))
    .sort((a, b) => b.total - a.total);
}

export function totalizarPedidos(
  filas: PedidoUnificado[],
  granularidad: Granularidad,
): TotalesPedidos {
  const totales: TotalesPedidos = {
    porBucket: new Map(),
    porMetodo: new Map(),
    porModalidad: new Map(),
    porCanal: new Map(),
    ventasBrutas: 0,
    costoDomicilioTotal: 0,
  };
  for (const p of filas) {
    totales.ventasBrutas += p.total;
    totales.costoDomicilioTotal += p.costo_domicilio;
    acumular(
      totales.porBucket,
      claveBucket(p.creado_en, granularidad),
      p.total,
    );
    acumular(totales.porMetodo, p.metodo_pago, p.total);
    acumular(totales.porModalidad, p.modalidad, p.total);
    acumular(totales.porCanal, p.canal, p.total);
  }
  return totales;
}

export function armarResumen(
  totales: Pick<TotalesPedidos, 'ventasBrutas' | 'costoDomicilioTotal'>,
  pedidos: number,
  articulosVendidos: number,
  diasEnRango: number,
): InformeDto['resumen'] {
  const { ventasBrutas, costoDomicilioTotal } = totales;
  return {
    ventas_brutas: ventasBrutas,
    promedio_diario: diasEnRango > 0 ? ventasBrutas / diasEnRango : 0,
    pedidos,
    articulos_vendidos: articulosVendidos,
    ticket_promedio: pedidos > 0 ? ventasBrutas / pedidos : 0,
    costo_domicilio_total: costoDomicilioTotal,
  };
}

/** Ventas por día del canal WhatsApp: los cancelados cuentan en el embudo, no acá. */
export function serieVentasBot(
  pedidos: PedidoBotFila[],
  granularidad: Granularidad,
): Map<string, Acumulador> {
  const porBucket = new Map<string, Acumulador>();
  for (const p of pedidos) {
    if (p.estado === 'cancelado') continue;
    acumular(
      porBucket,
      claveBucket(p.created_at, granularidad),
      Number(p.total),
    );
  }
  return porBucket;
}
