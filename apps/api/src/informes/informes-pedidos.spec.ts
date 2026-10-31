import {
  unificarPedidoHistorico,
  unificarPedidoVivo,
  type PedidoHistoricoFila,
  type PedidoVivoFila,
} from './informes-pedidos';

const CLIENTE = { telefono: '3157861208', nombre: 'Ana', apellido: 'Pérez' };

describe('unificarPedidoVivo', () => {
  const base: PedidoVivoFila = {
    id: 'p-1',
    total: 35000,
    costo_domicilio: 5000,
    metodo_pago: 'efectivo',
    modalidad: 'domicilio',
    canal: 'web',
    created_at: '2026-10-20T15:00:00.000Z',
    clientes: CLIENTE,
  };

  it('normaliza columnas y arma el nombre completo', () => {
    expect(unificarPedidoVivo(base)).toEqual({
      id: 'p-1',
      total: 35000,
      costo_domicilio: 5000,
      metodo_pago: 'efectivo',
      modalidad: 'domicilio',
      canal: 'web',
      creado_en: '2026-10-20T15:00:00.000Z',
      telefono: '3157861208',
      nombre_cliente: 'Ana Pérez',
    });
  });

  it('sin cliente ni costo de domicilio usa null y 0', () => {
    const pedido = unificarPedidoVivo({
      ...base,
      costo_domicilio: null,
      clientes: null,
    });
    expect(pedido).toMatchObject({
      costo_domicilio: 0,
      telefono: null,
      nombre_cliente: null,
    });
  });

  it('un cliente sin apellido no deja espacios sobrantes', () => {
    const pedido = unificarPedidoVivo({
      ...base,
      clientes: { ...CLIENTE, apellido: null },
    });
    expect(pedido.nombre_cliente).toBe('Ana');
  });
});

describe('unificarPedidoHistorico', () => {
  it('el histórico no trae domicilio y lee la fecha de creado_en', () => {
    const fila: PedidoHistoricoFila = {
      id: 'h-1',
      total: 28000,
      metodo_pago: 'transferencia',
      modalidad: 'retiro',
      canal: 'whatsapp',
      creado_en: '2025-03-01T12:00:00.000Z',
      historico_clientes: CLIENTE,
    };
    expect(unificarPedidoHistorico(fila)).toMatchObject({
      costo_domicilio: 0,
      creado_en: '2025-03-01T12:00:00.000Z',
      telefono: '3157861208',
      nombre_cliente: 'Ana Pérez',
    });
  });
});
