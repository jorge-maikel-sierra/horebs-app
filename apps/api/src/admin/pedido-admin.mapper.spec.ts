import { mapPedido } from './pedido-admin.mapper';

const FILA = {
  id: 'ped-1',
  canal: 'whatsapp',
  modalidad: 'retiro',
  direccion_entrega: null,
  costo_domicilio: 0,
  metodo_pago: 'efectivo',
  estado: 'pendiente',
  stock_status: 'ok',
  total: 40000,
  created_at: '2026-10-29T19:00:00Z',
  clientes: { id: 'cli-1', nombre: 'Ana', apellido: 'Pérez' },
  items_pedido: [
    {
      variante_id: 'v-1',
      cantidad: 1,
      precio_unitario: 40000,
      variantes_producto: {
        nombre: 'Mediana',
        productos: { nombre: 'Pizza Horebs Especial' },
      },
    },
  ],
};

describe('mapPedido', () => {
  it('lleva la nota del pedido, como qué sabores tiene una mitad y mitad', () => {
    const nota =
      'Pizza Mediana mitad Pizza Horebs Especial y mitad Pizza de Jamón y Queso.';
    expect(mapPedido({ ...FILA, notas: nota }).notas).toBe(nota);
  });

  it('sin nota la deja en null', () => {
    expect(mapPedido(FILA).notas).toBeNull();
    expect(mapPedido({ ...FILA, notas: null }).notas).toBeNull();
  });

  it('arma los ítems con el nombre del producto y el tamaño', () => {
    expect(mapPedido(FILA).items).toEqual([
      {
        variante_id: 'v-1',
        producto_nombre: 'Pizza Horebs Especial',
        variante_nombre: 'Mediana',
        cantidad: 1,
        precio_unitario: 40000,
      },
    ]);
  });

  it('marca la reserva y el comprobante cuando existen', () => {
    const pedido = mapPedido({
      ...FILA,
      programado_para: '2026-10-29T23:30:00Z',
      comprobante_path: 'comprobantes/ped-1.jpg',
    });
    expect(pedido.programado_para).toBe('2026-10-29T23:30:00Z');
    expect(pedido.tiene_comprobante).toBe(true);
  });
});
