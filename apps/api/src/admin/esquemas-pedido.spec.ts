import { validarObjeto } from '../common/validacion';
import { ESQUEMA_EDITAR_PEDIDO } from './esquemas';

const campos = (cuerpo: object) =>
  validarObjeto(ESQUEMA_EDITAR_PEDIDO, cuerpo).map((e) => e.campo);

describe('ESQUEMA_EDITAR_PEDIDO', () => {
  it('acepta lo que manda el modal de editar: método de pago y líneas', () => {
    expect(
      campos({
        metodo_pago: 'transferencia',
        items: [{ variante_id: 'v-1', cantidad: 2, precio_unitario: 40000 }],
      }),
    ).toEqual([]);
  });

  it('acepta cambiar solo el estado, como hace el tablero', () => {
    expect(campos({ estado: 'en_camino' })).toEqual([]);
  });

  it('rechaza un estado o un método de pago que no existen', () => {
    expect(campos({ estado: 'volando', metodo_pago: 'bitcoin' })).toEqual([
      'metodo_pago',
      'estado',
    ]);
  });

  it('items tiene que ser una lista y no se aceptan campos de más', () => {
    expect(campos({ items: 'dos pizzas', total: 1 })).toEqual([
      'items',
      'total',
    ]);
  });
});
