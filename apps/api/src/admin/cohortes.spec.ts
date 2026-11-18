import {
  cohortesPorCampana,
  cohortesPorMes,
  historiales,
  mesBogota,
  metricasDeCohorte,
  type PedidoCohorte,
} from './cohortes';

const AHORA = new Date('2026-11-17T12:00:00.000Z');

const pedido = (
  cliente: string | null,
  fecha: string,
  extra: Partial<PedidoCohorte> = {},
): PedidoCohorte => ({
  cliente_id: cliente,
  total: 10000,
  estado: 'entregado',
  created_at: `${fecha}T15:00:00.000Z`,
  campana_id: null,
  ...extra,
});

// A repite a los 20 días; B no repite; C es de hace 7 días.
const PEDIDOS = [
  pedido('A', '2026-09-01'),
  pedido('A', '2026-09-21'),
  pedido('B', '2026-09-10'),
  pedido('C', '2026-11-10'),
];

describe('mesBogota', () => {
  it('cuenta el mes en hora de Bogotá, no en UTC', () => {
    expect(mesBogota('2026-12-01T03:00:00.000Z')).toBe('2026-11');
  });
});

describe('historiales', () => {
  it('ordena cada cliente por fecha e ignora cancelados y pedidos sin cliente', () => {
    const mapa = historiales([
      pedido('A', '2026-09-21'),
      pedido('A', '2026-09-01'),
      pedido('A', '2026-09-05', { estado: 'cancelado' }),
      pedido(null, '2026-09-02'),
    ]);
    expect(mapa.size).toBe(1);
    expect(mapa.get('A')?.map((p) => p.created_at.slice(0, 10))).toEqual([
      '2026-09-01',
      '2026-09-21',
    ]);
  });
});

describe('metricasDeCohorte', () => {
  const clientes = [...historiales(PEDIDOS).values()];
  const m = metricasDeCohorte(clientes, AHORA);

  it('cuenta clientes, pedidos y valor', () => {
    expect(m).toMatchObject({
      clientes: 3,
      pedidos: 4,
      valor: 40000,
      pedidos_por_cliente: 1.3,
    });
  });

  it('mide la recompra solo entre quienes ya cumplieron la ventana', () => {
    const [d30, d60, d90] = m.recompra;
    // C compró hace 7 días: todavía no pudo volver, no cuenta en ninguna ventana.
    expect(d30).toEqual({ dias: 30, elegibles: 2, recompraron: 1, pct: 50 });
    expect(d60).toEqual({ dias: 60, elegibles: 2, recompraron: 1, pct: 50 });
    // Ni A ni B tienen aún 90 días: no hay base para un porcentaje.
    expect(d90).toEqual({ dias: 90, elegibles: 0, recompraron: 0, pct: null });
  });

  it('la mediana de días a la segunda compra sale de quienes repitieron', () => {
    expect(m.dias_a_segunda).toBe(20);
  });

  it('un grupo vacío no inventa promedios', () => {
    const vacio = metricasDeCohorte([], AHORA);
    expect(vacio.pedidos_por_cliente).toBeNull();
    expect(vacio.dias_a_segunda).toBeNull();
  });
});

describe('cohortesPorMes', () => {
  it('agrupa por el mes de la primera compra, del más reciente al más viejo', () => {
    const filas = cohortesPorMes(PEDIDOS, AHORA);
    expect(filas.map((f) => [f.mes, f.clientes])).toEqual([
      ['2026-11', 1],
      ['2026-09', 2],
    ]);
  });
});

describe('cohortesPorCampana', () => {
  const gasto = new Map([['c-1', { nombre: 'Noviembre', gasto: 20000 }]]);
  const pedidos = [
    pedido('A', '2026-11-01', { campana_id: 'c-1', total: 30000 }),
    pedido('A', '2026-11-05', { total: 20000 }),
    pedido('B', '2026-11-02', { campana_id: 'c-1' }),
    pedido('C', '2026-11-03'),
    pedido('D', '2026-10-01', { campana_id: 'c-1' }),
    pedido('E', '2026-11-04', { campana_id: 'c-1' }),
  ];
  const opciones = {
    gasto,
    desde: '2026-11-01T00:00:00Z',
    // E ya era cliente antes del período: pide ahora, pero no es nuevo.
    nuevosIds: new Set(['A', 'B', 'C']),
    ahora: AHORA,
  };

  it('une a los clientes nuevos con la campaña de su primera compra y calcula el costo', () => {
    const r = cohortesPorCampana(pedidos, opciones);
    expect(r.nuevos).toBe(3);
    expect(r.atribuidos).toBe(2);
    expect(r.campanas).toHaveLength(1);
    expect(r.campanas[0]).toMatchObject({
      campana_id: 'c-1',
      nombre: 'Noviembre',
      clientes: 2,
      valor: 60000,
      costo_por_cliente_nuevo: 10000,
      valor_sobre_gasto: 3,
    });
  });

  it('un cliente que ya existía antes del período no es nuevo', () => {
    const r = cohortesPorCampana(pedidos, opciones);
    expect(r.campanas[0].clientes).toBe(2);
  });

  it('una campaña sin gasto conocido no inventa costos', () => {
    const r = cohortesPorCampana(pedidos, { ...opciones, gasto: new Map() });
    expect(r.campanas[0].costo_por_cliente_nuevo).toBeNull();
    expect(r.campanas[0].valor_sobre_gasto).toBeNull();
  });
});
