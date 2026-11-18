import {
  margenDeVariante,
  resumenRentabilidad,
  utilidadDePedido,
  type FilaItemCosto,
} from './rentabilidad';

const item = (
  cantidad: number,
  subtotal: number,
  costo: number | null,
): FilaItemCosto => ({
  cantidad,
  subtotal,
  variantes_producto: costo === null ? null : { costo },
});

describe('utilidadDePedido', () => {
  it('resta el costo de cada línea por su cantidad', () => {
    expect(utilidadDePedido([item(2, 60000, 12000)])).toEqual({
      ventas: 60000,
      utilidad: 36000,
      completo: true,
    });
  });

  it('una línea sin costo deja el pedido incompleto', () => {
    const u = utilidadDePedido([item(1, 30000, 10000), item(1, 5000, null)]);
    expect(u?.completo).toBe(false);
    expect(u?.ventas).toBe(35000);
  });

  it('un costo de 0 es un costo (no cuenta como faltante)', () => {
    expect(utilidadDePedido([item(1, 5000, 0)])?.completo).toBe(true);
  });

  it('sin líneas no hay nada que valorar', () => {
    expect(utilidadDePedido([])).toBeNull();
    expect(utilidadDePedido(null)).toBeNull();
  });
});

describe('resumenRentabilidad', () => {
  it('solo cuenta la utilidad de pedidos con costo completo y mide la cobertura', () => {
    const r = resumenRentabilidad([
      { items_pedido: [item(1, 40000, 10000)] },
      { items_pedido: [item(1, 60000, null)] },
    ]);
    expect(r).toEqual({
      ventas_productos: 100000,
      ventas_con_costo: 40000,
      costo_total: 10000,
      utilidad_bruta: 30000,
      margen_pct: 75,
      cobertura_costos: 40,
    });
  });

  it('sin costos cargados no inventa margen ni cobertura', () => {
    const r = resumenRentabilidad([{ items_pedido: [item(1, 40000, null)] }]);
    expect(r.utilidad_bruta).toBe(0);
    expect(r.margen_pct).toBeNull();
    expect(r.cobertura_costos).toBe(0);
  });

  it('sin pedidos todo queda en cero o nulo', () => {
    expect(resumenRentabilidad([]).cobertura_costos).toBeNull();
  });
});

describe('margenDeVariante', () => {
  it('calcula el margen en pesos y en porcentaje', () => {
    expect(margenDeVariante(40000, 10000)).toEqual({
      margen: 30000,
      margen_pct: 75,
    });
  });

  it('sin costo no hay margen', () => {
    expect(margenDeVariante(40000, null)).toBeNull();
  });
});
