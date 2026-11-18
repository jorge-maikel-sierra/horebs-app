import {
  campanaDePedido,
  campanasRecientes,
  rendimientoPorAnuncio,
  rendimientoPorCampana,
  resumenGeneral,
  type FilaGastoDia,
  type FilaPedidoTablero,
} from './anuncios-gasto';

const gasto = (extra: Partial<FilaGastoDia> = {}): FilaGastoDia => ({
  anuncio_id: 'a-1',
  campana_id: 'c-1',
  campana_nombre: 'Noviembre',
  fecha: '2026-11-10',
  gasto: '10000',
  impresiones: 100,
  alcance: 80,
  clics: 5,
  frecuencia: 1.5,
  conversaciones: 4,
  clics_enlace: 3,
  ...extra,
});

const pedido = (extra: Partial<FilaPedidoTablero> = {}): FilaPedidoTablero => ({
  id: 'p-1',
  total: 30000,
  estado: 'entregado',
  cliente_id: null,
  origen_anuncio_id: null,
  origen_campana_id: null,
  atribucion_web: null,
  ...extra,
});

describe('campanaDePedido', () => {
  const idx = {
    campanaDeAnuncio: new Map([['a-1', 'c-1']]),
    campanaPorNombre: new Map([['noviembre', 'c-1']]),
  };

  it('prefiere la campaña que eligió la caja', () => {
    expect(
      campanaDePedido(
        pedido({ origen_campana_id: 'c-9', origen_anuncio_id: 'a-1' }),
        idx,
      ),
    ).toBe('c-9');
  });

  it('traduce el anuncio del bot a su campaña', () => {
    expect(campanaDePedido(pedido({ origen_anuncio_id: 'a-1' }), idx)).toBe(
      'c-1',
    );
  });

  it('usa el utm_campaign de la web sin importar mayúsculas', () => {
    const web = pedido({ atribucion_web: { utm_campaign: ' NOVIEMBRE ' } });
    expect(campanaDePedido(web, idx)).toBe('c-1');
  });

  it('sin ninguna pista no se atribuye', () => {
    expect(campanaDePedido(pedido(), idx)).toBeNull();
  });
});

describe('rendimientoPorCampana', () => {
  const dias = [gasto(), gasto({ fecha: '2026-11-11', gasto: '5000' })];

  it('suma el gasto, cuenta pedidos atribuidos y calcula costo y ROAS', () => {
    const [c] = rendimientoPorCampana(
      dias,
      [
        pedido({ origen_campana_id: 'c-1', cliente_id: 'k-1' }),
        pedido({ id: 'p-2', origen_campana_id: 'c-1', total: 15000 }),
        pedido({ id: 'p-3', origen_campana_id: 'c-1', estado: 'cancelado' }),
      ],
      new Set(['k-1']),
    );
    expect(c).toMatchObject({
      gasto: 15000,
      pedidos: 2,
      ventas: 45000,
      clientes_nuevos: 1,
      costo_por_pedido: 7500,
      costo_por_cliente_nuevo: 15000,
      roas: 3,
    });
  });

  it('una campaña sin pedidos no inventa costos', () => {
    const [c] = rendimientoPorCampana(dias, [], new Set());
    expect(c.costo_por_pedido).toBeNull();
    expect(c.roas).toBe(0);
  });

  it('ordena de más a menos gasto', () => {
    const filas = rendimientoPorCampana(
      [
        gasto(),
        gasto({ campana_id: 'c-2', anuncio_id: 'a-2', gasto: '99999' }),
      ],
      [],
      new Set(),
    );
    expect(filas.map((f) => f.campana_id)).toEqual(['c-2', 'c-1']);
  });
});

describe('resumenGeneral', () => {
  it('divide las ventas de todos los canales entre el gasto total', () => {
    const r = resumenGeneral(
      [gasto()],
      [
        pedido({ origen_campana_id: 'c-1' }),
        pedido({ id: 'p-2', total: 20000 }),
        pedido({ id: 'p-3', estado: 'cancelado' }),
      ],
    );
    expect(r).toEqual({
      gasto_total: 10000,
      ventas_totales: 50000,
      pedidos_totales: 2,
      pedidos_atribuidos: 1,
      roas_general: 5,
    });
  });

  it('sin gasto no hay ROAS', () => {
    expect(resumenGeneral([], [pedido()]).roas_general).toBeNull();
  });
});

describe('campanasRecientes', () => {
  it('lista cada campaña una vez, con su nombre', () => {
    expect(
      campanasRecientes([gasto(), gasto({ fecha: '2026-11-11' })]),
    ).toEqual([{ id: 'c-1', nombre: 'Noviembre' }]);
  });
});

describe('mensajes y frecuencia por campaña', () => {
  it('suma conversaciones, calcula el costo de cada una y pondera la frecuencia por impresiones', () => {
    const [c] = rendimientoPorCampana(
      [
        gasto({
          gasto: '8000',
          impresiones: 100,
          frecuencia: 1,
          conversaciones: 2,
        }),
        gasto({
          fecha: '2026-11-11',
          gasto: '2000',
          impresiones: 300,
          frecuencia: 2,
          conversaciones: 3,
        }),
      ],
      [],
      new Set(),
    );
    expect(c.conversaciones).toBe(5);
    expect(c.costo_por_conversacion).toBe(2000);
    expect(c.frecuencia).toBe(1.75);
  });

  it('sin conversaciones no hay costo por conversación', () => {
    const [c] = rendimientoPorCampana(
      [gasto({ conversaciones: 0 })],
      [],
      new Set(),
    );
    expect(c.costo_por_conversacion).toBeNull();
  });
});

describe('rendimientoPorAnuncio', () => {
  const creativo = {
    anuncio_id: 'a-1',
    nombre: 'Reel Horebs',
    estado: 'ACTIVE',
    miniatura_url: 'https://x/y.jpg',
    titulo: '20% en la Especial',
    texto: null,
  };

  it('une el gasto con su creativo y calcula CTR y costo por conversación', () => {
    const [a] = rendimientoPorAnuncio(
      [
        gasto({
          gasto: '6000',
          impresiones: 1000,
          clics_enlace: 20,
          conversaciones: 3,
        }),
      ],
      [creativo],
      [
        pedido({ origen_anuncio_id: 'a-1' }),
        pedido({ id: 'p-2', origen_anuncio_id: 'a-1', estado: 'cancelado' }),
      ],
    );
    expect(a).toMatchObject({
      nombre: 'Reel Horebs',
      miniatura_url: 'https://x/y.jpg',
      ctr: 2,
      costo_por_conversacion: 2000,
      pedidos: 1,
      campana: 'Noviembre',
    });
  });

  it('sin creativo sincronizado usa el id como nombre y ordena por gasto', () => {
    const filas = rendimientoPorAnuncio(
      [
        gasto({ anuncio_id: 'a-1', gasto: '10' }),
        gasto({ anuncio_id: 'a-2', gasto: '99' }),
      ],
      [],
      [],
    );
    expect(filas.map((f) => f.nombre)).toEqual(['a-2', 'a-1']);
    expect(filas[0].miniatura_url).toBeNull();
  });
});
