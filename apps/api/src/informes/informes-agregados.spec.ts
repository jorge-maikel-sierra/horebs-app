import {
  acumular,
  acumularProducto,
  armarResumen,
  serieVentasBot,
  serializarCanales,
  serializarMapa,
  totalizarPedidos,
} from './informes-agregados';
import type {
  Acumulador,
  PedidoBotFila,
  PedidoUnificado,
} from './informes.tipos';

function pedido(extra: Partial<PedidoUnificado> = {}): PedidoUnificado {
  return {
    id: 'p-1',
    total: 10_000,
    costo_domicilio: 0,
    metodo_pago: 'efectivo',
    modalidad: 'local',
    canal: 'pos',
    creado_en: '2026-10-10T20:00:00.000Z',
    telefono: null,
    nombre_cliente: null,
    ...extra,
  };
}

describe('acumular', () => {
  it('suma el monto y cuenta los pedidos de cada clave', () => {
    const mapa = new Map<string, Acumulador>();

    acumular(mapa, 'efectivo', 100);
    acumular(mapa, 'efectivo', 50);
    acumular(mapa, 'tarjeta', 10);

    expect(mapa.get('efectivo')).toEqual({ total: 150, pedidos: 2 });
    expect(mapa.get('tarjeta')).toEqual({ total: 10, pedidos: 1 });
  });

  it('acumularProducto suma cantidades y subtotales', () => {
    const mapa = new Map<string, { cantidad: number; total: number }>();

    acumularProducto(mapa, 'Hawaiana', 2, 36_000);
    acumularProducto(mapa, 'Hawaiana', 1, 18_000);

    expect(mapa.get('Hawaiana')).toEqual({ cantidad: 3, total: 54_000 });
  });

  it('serializarMapa ordena de mayor a menor total', () => {
    const mapa = new Map([
      ['a', { total: 10, pedidos: 1 }],
      ['b', { total: 30, pedidos: 2 }],
    ]);

    expect(serializarMapa(mapa).map((d) => d.clave)).toEqual(['b', 'a']);
  });

  it('serializarCanales incluye los 5 canales confirmados ordenados por total', () => {
    const mapa = new Map([
      ['whatsapp', { total: 50_000, pedidos: 2 }],
      ['web', { total: 100_000, pedidos: 4 }],
    ]);

    const resultado = serializarCanales(mapa);
    expect(resultado.map((r) => r.clave)).toEqual([
      'web',
      'whatsapp',
      'pos',
      'messenger',
      'instagram',
    ]);
    expect(resultado.find((r) => r.clave === 'messenger')).toEqual({
      clave: 'messenger',
      total: 0,
      pedidos: 0,
    });
    expect(resultado.find((r) => r.clave === 'instagram')).toEqual({
      clave: 'instagram',
      total: 0,
      pedidos: 0,
    });
  });
});

describe('totalizarPedidos', () => {
  it('suma ventas, domicilios y agrupa por método, modalidad, canal y día', () => {
    const totales = totalizarPedidos(
      [
        pedido({
          total: 20_000,
          costo_domicilio: 5_000,
          modalidad: 'domicilio',
        }),
        pedido({ total: 10_000, metodo_pago: 'transferencia', canal: 'web' }),
      ],
      'dia',
    );

    expect(totales.ventasBrutas).toBe(30_000);
    expect(totales.costoDomicilioTotal).toBe(5_000);
    expect(totales.porMetodo.get('efectivo')).toEqual({
      total: 20_000,
      pedidos: 1,
    });
    expect(totales.porModalidad.get('domicilio')?.pedidos).toBe(1);
    expect(totales.porCanal.get('web')?.total).toBe(10_000);
    expect(totales.porBucket.get('2026-10-10')).toEqual({
      total: 30_000,
      pedidos: 2,
    });
  });

  it('agrupa por mes con granularidad mes', () => {
    const totales = totalizarPedidos([pedido()], 'mes');

    expect([...totales.porBucket.keys()]).toEqual(['2026-10']);
  });

  it('sin pedidos todo queda en cero', () => {
    const totales = totalizarPedidos([], 'dia');

    expect(totales.ventasBrutas).toBe(0);
    expect(totales.porBucket.size).toBe(0);
  });
});

describe('armarResumen', () => {
  const totales = { ventasBrutas: 90_000, costoDomicilioTotal: 10_000 };

  it('calcula promedio diario y ticket promedio', () => {
    expect(armarResumen(totales, 3, 7, 3)).toEqual({
      ventas_brutas: 90_000,
      promedio_diario: 30_000,
      pedidos: 3,
      articulos_vendidos: 7,
      ticket_promedio: 30_000,
      costo_domicilio_total: 10_000,
    });
  });

  it('sin pedidos ni días no divide por cero', () => {
    const vacio = armarResumen(
      { ventasBrutas: 0, costoDomicilioTotal: 0 },
      0,
      0,
      0,
    );

    expect(vacio.promedio_diario).toBe(0);
    expect(vacio.ticket_promedio).toBe(0);
  });
});

describe('serieVentasBot', () => {
  const fila = (extra: Partial<PedidoBotFila>): PedidoBotFila => ({
    total: 10_000,
    estado: 'entregado',
    created_at: '2026-10-10T20:00:00.000Z',
    programado_para: null,
    comprobante_recibido_en: null,
    ...extra,
  });

  it('no cuenta los pedidos cancelados', () => {
    const serie = serieVentasBot(
      [fila({}), fila({ estado: 'cancelado', total: 99_000 })],
      'dia',
    );

    expect(serie.get('2026-10-10')).toEqual({ total: 10_000, pedidos: 1 });
  });

  it('convierte el total a número', () => {
    const serie = serieVentasBot(
      [fila({ total: '7500' as unknown as number })],
      'dia',
    );

    expect(serie.get('2026-10-10')?.total).toBe(7_500);
  });
});
