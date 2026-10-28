import type { Acumulador, InformeDesgloseDto } from './informes.tipos';

export function acumular(
  mapa: Map<string, Acumulador>,
  clave: string,
  monto: number,
) {
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
) {
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
