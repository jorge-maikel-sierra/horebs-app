import { limiteDeMovimientos, mapMovimiento } from './movimientos-reglas';
import {
  LIMITE_POR_DEFECTO,
  MAX_LIMITE,
  type FilaMovimiento,
} from './movimientos.tipos';

const FILA: FilaMovimiento = {
  id: 'm-1',
  insumo_id: 'i-1',
  tipo: 'venta',
  cantidad_g: -250,
  referencia_tipo: 'pedido',
  referencia_id: 'p-1',
  motivo: null,
  created_at: '2026-10-30T10:00:00Z',
  insumos: { nombre: 'Harina', unidad_medida: 'g' },
};

describe('limiteDeMovimientos', () => {
  it.each([
    [undefined, LIMITE_POR_DEFECTO],
    [50, 50],
    [MAX_LIMITE, MAX_LIMITE],
    [MAX_LIMITE + 1, MAX_LIMITE],
  ])('%s se vuelve %s', (entrada, esperado) => {
    expect(limiteDeMovimientos(entrada)).toBe(esperado);
  });
});

describe('mapMovimiento', () => {
  it('aplana el nombre y la unidad del insumo', () => {
    expect(mapMovimiento(FILA)).toEqual({
      id: 'm-1',
      insumo_id: 'i-1',
      insumo_nombre: 'Harina',
      unidad_medida: 'g',
      tipo: 'venta',
      cantidad_g: -250,
      referencia_tipo: 'pedido',
      referencia_id: 'p-1',
      motivo: null,
      created_at: '2026-10-30T10:00:00Z',
    });
  });

  it('un insumo eliminado se muestra con valores neutros en vez de reventar', () => {
    expect(mapMovimiento({ ...FILA, insumos: null })).toMatchObject({
      insumo_nombre: '(insumo eliminado)',
      unidad_medida: 'g',
    });
  });
});
