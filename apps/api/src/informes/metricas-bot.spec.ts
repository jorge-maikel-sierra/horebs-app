import { agregarMetricasBot } from './metricas-bot';

const pedido = (
  estado: string,
  total: number,
  extra: { reserva?: boolean; comprobante?: boolean } = {},
) => ({
  estado,
  total,
  reserva: extra.reserva ?? false,
  comprobante: extra.comprobante ?? false,
});

describe('agregarMetricasBot', () => {
  it('arma el embudo sin contar cancelados como venta', () => {
    const m = agregarMetricasBot({
      pedidos: [
        pedido('entregado', 70000, { comprobante: true }),
        pedido('pendiente', 30000, { reserva: true }),
        pedido('cancelado', 50000, { reserva: true }),
      ],
      conversacionesConMensaje: ['a', 'a', 'b', 'c', 'd'],
      derivaciones: 1,
      repetirToques: 2,
      recomprasEnviadas: 3,
    });
    expect(m).toEqual({
      conversaciones: 4,
      pedidos: 2,
      ventas: 100000,
      ticket_promedio: 50000,
      conversion: 0.5,
      entregados: 1,
      cancelados: 1,
      derivaciones: 1,
      repetir_toques: 2,
      recompras_enviadas: 3,
      reservas: 1,
      comprobantes: 1,
    });
  });

  it('sin conversaciones ni pedidos todo queda en 0', () => {
    const m = agregarMetricasBot({
      pedidos: [],
      conversacionesConMensaje: [],
      derivaciones: 0,
      repetirToques: 0,
      recomprasEnviadas: 0,
    });
    expect(m.conversion).toBe(0);
    expect(m.ticket_promedio).toBe(0);
  });
});
