import type {
  FilaPedidoCampana,
  ResultadoCampanaDto,
} from './campanas-mensajeria.tipos';
import { redondearUno, resumenRentabilidad } from './rentabilidad';

/**
 * Pedidos, ventas y retorno de cada campaña propia frente a lo que costó.
 * Puro, sin Nest. Los pedidos cancelados no cuentan.
 */
export function resultadosPorCampana(
  campanas: { id: string; costo: number | null }[],
  pedidos: FilaPedidoCampana[],
): ResultadoCampanaDto[] {
  const porCampana = new Map<string, FilaPedidoCampana[]>();
  for (const p of pedidos) {
    if (p.estado === 'cancelado') continue;
    const lista = porCampana.get(p.campana_mensajeria_id) ?? [];
    lista.push(p);
    porCampana.set(p.campana_mensajeria_id, lista);
  }
  return campanas.map((c) => resultadoDe(c, porCampana.get(c.id) ?? []));
}

function resultadoDe(
  campana: { id: string; costo: number | null },
  pedidos: FilaPedidoCampana[],
): ResultadoCampanaDto {
  const ventas = pedidos.reduce((suma, p) => suma + Number(p.total), 0);
  const rentabilidad = resumenRentabilidad(pedidos);
  const costo = campana.costo && campana.costo > 0 ? campana.costo : null;
  const clientes = new Set(
    pedidos.map((p) => p.cliente_id).filter((id): id is string => !!id),
  );
  return {
    campana_id: campana.id,
    pedidos: pedidos.length,
    ventas,
    clientes: clientes.size,
    utilidad_bruta: rentabilidad.utilidad_bruta,
    cobertura_costos: rentabilidad.cobertura_costos,
    costo_por_pedido:
      costo !== null && pedidos.length > 0
        ? Math.round(costo / pedidos.length)
        : null,
    roas: costo !== null ? redondearUno(ventas / costo) : null,
    retorno_utilidad:
      costo !== null ? redondearUno(rentabilidad.utilidad_bruta / costo) : null,
  };
}
