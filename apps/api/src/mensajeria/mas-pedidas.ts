import type { CategoriaDto, ProductoDto } from '../catalog/catalog.service';
import { esAdicional } from './adicionales';
import { lineaDePrecios } from './opciones-social';

export const CANTIDAD_MAS_PEDIDAS = 3;
export const NOMBRE_CATEGORIA_PIZZA = 'Pizza';

/**
 * Las pizzas que se sugieren cuando el cliente pregunta "¿cuánto cuesta?" sin
 * nombrar un producto: primero las del ranking de pedidos reales (en ese
 * orden); si faltan, las de más ventas históricas y después las destacadas.
 * Solo pizzas activas del catálogo, nunca adicionales.
 */
export function elegirMasPedidas(
  ranking: string[],
  productos: ProductoDto[],
  categorias: CategoriaDto[],
  cantidad = CANTIDAD_MAS_PEDIDAS,
): ProductoDto[] {
  const pizza = categorias.find((c) => c.nombre === NOMBRE_CATEGORIA_PIZZA);
  const pizzas = productos.filter(
    (p) =>
      (!pizza || p.categoria_id === pizza.id) &&
      !esAdicional(p.nombre) &&
      p.variantes.length > 0,
  );
  const porId = new Map(pizzas.map((p) => [p.id, p]));
  const delRanking = ranking
    .map((id) => porId.get(id))
    .filter((p): p is ProductoDto => p !== undefined);
  const respaldo = [...pizzas].sort(
    (a, b) =>
      (b.ventas_historicas ?? 0) - (a.ventas_historicas ?? 0) ||
      Number(b.destacado) - Number(a.destacado),
  );
  const elegidas = [...delRanking];
  for (const p of respaldo) {
    if (elegidas.length >= cantidad) break;
    if (!elegidas.includes(p)) elegidas.push(p);
  }
  return elegidas.slice(0, cantidad);
}

/** Tres líneas de precios (no la lista completa) y una pregunta para avanzar al pedido. */
export function textoMasPedidas(pizzas: ProductoDto[]): string {
  const lineas = pizzas.map((p) => `• ${lineaDePrecios(p)}`).join('\n');
  return `Nuestras pizzas más pedidas 🍕\n${lineas}\n¿Cuál te provoca?`;
}
