import { COSTO_DOMICILIO_DEFAULT } from '../common/costos';
import type { ItemCalculado } from './calcular-items';
import {
  armarPedidoDto,
  avisoDomicilio,
  costoDomicilioDeCheckout,
  datosClienteUpsert,
  filasItemsPedido,
  itemsParaDescuento,
  mapPedido,
  payloadPedido,
} from './pedidos-reglas';
import type {
  DatosPedido,
  FilaClientePedido,
  FilaPedidoCompleto,
  FilaPedidoCreado,
} from './pedidos.tipos';

const ITEM: ItemCalculado = {
  variante_id: 'v-1',
  cantidad: 2,
  precio_unitario: 30000,
  subtotal: 60000,
  producto_nombre: 'Pizza Hawaiana',
  variante_nombre: 'Mediana',
};

const CLIENTE: FilaClientePedido = {
  id: 'c-1',
  nombre: 'Ana',
  apellido: null,
  telefono: '3157861208',
  correo: null,
  direccion: null,
};

const PEDIDO: FilaPedidoCreado = {
  id: 'p-1',
  modalidad: 'domicilio',
  direccion_entrega: 'Calle 1',
  costo_domicilio: COSTO_DOMICILIO_DEFAULT,
  metodo_pago: 'efectivo',
  estado: 'pendiente',
  total: 65000,
  notas: null,
  created_at: '2026-10-30T10:00:00Z',
};

function datos(cambios: Partial<DatosPedido> = {}): DatosPedido {
  return {
    cliente: { nombre: 'Ana', apellido: 'Pérez', telefono: '3157861208' },
    modalidad: 'domicilio',
    direccion_entrega: 'Calle 1',
    metodo_pago: 'efectivo',
    items: [{ variante_id: 'v-1', cantidad: 2 }],
    ...cambios,
  };
}

describe('costoDomicilioDeCheckout', () => {
  it.each([
    ['domicilio', COSTO_DOMICILIO_DEFAULT],
    ['retiro', 0],
    ['local', 0],
  ] as const)('%s cuesta %s', (modalidad, costo) => {
    expect(costoDomicilioDeCheckout(modalidad)).toBe(costo);
  });
});

describe('datosClienteUpsert', () => {
  it('sin correo ni dirección no los incluye, para no pisar los guardados', () => {
    expect(datosClienteUpsert(datos().cliente)).toEqual({
      nombre: 'Ana',
      apellido: 'Pérez',
      telefono: '3157861208',
    });
  });

  it('con correo y dirección los incluye', () => {
    const cliente = {
      ...datos().cliente,
      correo: 'a@b.co',
      direccion: 'Calle 1',
    };
    expect(datosClienteUpsert(cliente)).toMatchObject({
      correo: 'a@b.co',
      direccion: 'Calle 1',
    });
  });
});

describe('payloadPedido', () => {
  const montos = {
    clienteId: 'c-1',
    canal: 'web' as const,
    costoDomicilio: COSTO_DOMICILIO_DEFAULT,
    total: 63000,
    canje: { puntos: 40, descuento: 2000 },
  };

  it('copia los montos y el canje, y sin reserva no manda programado_para', () => {
    const payload = payloadPedido(datos(), montos);

    expect(payload).toMatchObject({
      cliente_id: 'c-1',
      canal: 'web',
      total: 63000,
      puntos_canjeados: 40,
      descuento_puntos: 2000,
      notas: null,
      idempotency_key: null,
    });
    expect(payload).not.toHaveProperty('programado_para');
  });

  it('con reserva manda programado_para', () => {
    const payload = payloadPedido(
      datos({ programado_para: '2026-10-30T20:00:00Z' }),
      montos,
    );
    expect(payload.programado_para).toBe('2026-10-30T20:00:00Z');
  });

  it('un retiro no lleva dirección de entrega aunque venga una', () => {
    const payload = payloadPedido(datos({ modalidad: 'retiro' }), montos);
    expect(payload.direccion_entrega).toBeNull();
  });
});

describe('items del pedido', () => {
  it('filasItemsPedido enlaza cada ítem al pedido', () => {
    expect(filasItemsPedido('p-1', [ITEM])).toEqual([
      {
        pedido_id: 'p-1',
        variante_id: 'v-1',
        cantidad: 2,
        precio_unitario: 30000,
        subtotal: 60000,
      },
    ]);
  });

  it('itemsParaDescuento solo lleva variante y cantidad', () => {
    expect(itemsParaDescuento([ITEM])).toEqual([
      { variante_id: 'v-1', cantidad: 2 },
    ]);
  });
});

describe('avisoDomicilio', () => {
  it('un domicilio con dirección arma el aviso con nombre y variante', () => {
    const aviso = avisoDomicilio(PEDIDO, CLIENTE, [ITEM]);

    expect(aviso).toMatchObject({
      pedidoId: 'p-1',
      clienteNombre: 'Ana',
      direccionEntrega: 'Calle 1',
      costoDomicilio: COSTO_DOMICILIO_DEFAULT,
      items: [
        {
          cantidad: 2,
          nombre: 'Pizza Hawaiana (Mediana)',
          precioUnitario: 30000,
        },
      ],
    });
  });

  it('un domicilio gratis manda costoDomicilio null', () => {
    const aviso = avisoDomicilio({ ...PEDIDO, costo_domicilio: 0 }, CLIENTE, [
      ITEM,
    ]);
    expect(aviso?.costoDomicilio).toBeNull();
  });

  it.each([
    ['un retiro', { modalidad: 'retiro' }],
    ['un domicilio sin dirección', { direccion_entrega: null }],
  ])('%s no avisa', (_caso, cambios) => {
    expect(
      avisoDomicilio({ ...PEDIDO, ...cambios }, CLIENTE, [ITEM]),
    ).toBeNull();
  });
});

describe('armarPedidoDto', () => {
  it('junta el pedido, el cliente, los ítems y los puntos', () => {
    const dto = armarPedidoDto({
      pedido: PEDIDO,
      cliente: CLIENTE,
      items: [ITEM],
      canje: { puntos: 40, descuento: 2000 },
      puntosGanados: 6,
    });

    expect(dto).toMatchObject({
      id: 'p-1',
      estado: 'pendiente',
      cliente: { nombre: 'Ana', telefono: '3157861208' },
      items: [{ variante_id: 'v-1', producto_nombre: 'Pizza Hawaiana' }],
      puntos_canjeados: 40,
      descuento_puntos: 2000,
      puntos_ganados: 6,
    });
  });
});

describe('mapPedido', () => {
  const fila: FilaPedidoCompleto = {
    ...PEDIDO,
    puntos_canjeados: 0,
    descuento_puntos: 0,
    puntos_ganados: 6,
    clientes: {
      nombre: 'Ana',
      apellido: null,
      telefono: '3157861208',
      correo: null,
      direccion: null,
    },
    items_pedido: [
      {
        variante_id: 'v-1',
        cantidad: 2,
        precio_unitario: 30000,
        subtotal: 60000,
        variantes_producto: {
          nombre: 'Mediana',
          productos: { nombre: 'Pizza Hawaiana' },
        },
      },
    ],
  };

  it('aplana el producto y la variante de cada ítem', () => {
    expect(mapPedido(fila).items).toEqual([
      {
        variante_id: 'v-1',
        producto_nombre: 'Pizza Hawaiana',
        variante_nombre: 'Mediana',
        cantidad: 2,
        precio_unitario: 30000,
        subtotal: 60000,
      },
    ]);
  });

  it('si los joins vienen null deja textos vacíos en vez de reventar', () => {
    const dto = mapPedido({ ...fila, clientes: null, items_pedido: null });

    expect(dto.cliente).toEqual({
      nombre: '',
      apellido: null,
      telefono: '',
      correo: null,
      direccion: null,
    });
    expect(dto.items).toEqual([]);
  });

  it('un ítem sin variante ni producto queda con nombres vacíos', () => {
    const dto = mapPedido({
      ...fila,
      items_pedido: [{ ...fila.items_pedido![0], variantes_producto: null }],
    });
    expect(dto.items[0]).toMatchObject({
      producto_nombre: '',
      variante_nombre: '',
    });
  });
});
