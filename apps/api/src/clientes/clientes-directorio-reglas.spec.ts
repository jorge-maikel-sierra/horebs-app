import {
  armarDirectorio,
  coincide,
  coincidencias,
  contarSegmentos,
  cumpleSegmento,
  digitosTelefono,
  entero,
  filasDeDirectorio,
  metricasDePedidos,
  ordenar,
  paginar,
  plegar,
  puntajeTermino,
  terminosDeBusqueda,
} from './clientes-directorio-reglas';
import type {
  Coincidencia,
  FilaClienteDirectorio,
  FilaDirectorio,
} from './clientes-directorio.tipos';

const AHORA = Date.parse('2026-11-01T12:00:00.000Z');
const MS_POR_DIA = 86_400_000;

function cliente(
  id: string,
  extra: Partial<FilaClienteDirectorio> = {},
): FilaClienteDirectorio {
  return {
    id,
    nombre: id,
    apellido: null,
    telefono: null,
    direccion: null,
    correo: null,
    cedula: null,
    created_at: '2026-01-01T00:00:00.000Z',
    puntos_actuales: 0,
    ...extra,
  };
}

function fila(
  id: string,
  extra: Partial<FilaClienteDirectorio> = {},
  pedidos: { total: number; created_at: string }[] = [],
): FilaDirectorio {
  return filasDeDirectorio(
    [cliente(id, extra)],
    pedidos.map((p) => ({ cliente_id: id, ...p })),
  )[0];
}

const ids = (lista: Coincidencia[]): string[] => lista.map((c) => c.fila.id);

describe('texto de búsqueda', () => {
  it('plegar quita tildes y pasa a minúsculas', () => {
    expect(plegar('José NÚÑEZ')).toBe('jose nunez');
  });

  it('coincide solo al inicio de una palabra', () => {
    expect(coincide('ana perez', 'ana')).toBe(true);
    expect(coincide('maria ana', 'ana')).toBe(true);
    expect(coincide('mediana', 'ana')).toBe(false);
    expect(coincide('ana', '')).toBe(false);
  });

  it('digitosTelefono ignora el indicativo +57 y la puntuación', () => {
    expect(digitosTelefono('+57 315 786-1208')).toBe('3157861208');
    expect(digitosTelefono('(315) 786 1208')).toBe('3157861208');
  });

  it('terminosDeBusqueda descarta el +57 suelto y se limita a 6 términos', () => {
    expect(terminosDeBusqueda('  +57  Ana ')).toEqual(['ana']);
    expect(terminosDeBusqueda(undefined)).toEqual([]);
    expect(terminosDeBusqueda('a b c d e f g h')).toHaveLength(6);
  });

  it('entero trunca y usa el valor por defecto si no es número', () => {
    expect(entero('3.9', 1)).toBe(3);
    expect(entero('abc', 7)).toBe(7);
    expect(entero(undefined, 7)).toBe(7);
  });
});

describe('puntajeTermino', () => {
  const ana = fila('c-1', {
    nombre: 'Ana',
    apellido: 'Pérez',
    telefono: '315 786 1208',
    cedula: '1118843420',
    direccion: 'Carrera 7',
    correo: 'ana@correo.co',
  });

  it('el nombre pesa más que el resto', () => {
    expect(puntajeTermino(ana, 'ana')).toBe(100);
    expect(puntajeTermino(ana, 'perez')).toBe(80);
    expect(puntajeTermino(ana, 'carrera')).toBe(20);
    expect(puntajeTermino(ana, 'zzz')).toBe(0);
  });

  it('un número de 3 dígitos o más busca en teléfono y cédula', () => {
    expect(puntajeTermino(ana, '3157')).toBe(70);
    expect(puntajeTermino(ana, '11188')).toBe(60);
    expect(puntajeTermino(ana, '99')).toBe(0);
  });
});

describe('coincidencias y segmentos', () => {
  const a = fila('ana', { puntos_actuales: 50 }, [
    { total: 10_000, created_at: '2026-10-01T00:00:00.000Z' },
    { total: 20_000, created_at: '2026-10-20T00:00:00.000Z' },
  ]);
  const b = fila('beto', {
    created_at: new Date(AHORA - 5 * MS_POR_DIA).toISOString(),
  });
  const corte = AHORA - 30 * MS_POR_DIA;

  it('exige todos los términos', () => {
    expect(ids(coincidencias([a, b], ['ana']))).toEqual(['ana']);
    expect(ids(coincidencias([a, b], ['ana', 'beto']))).toEqual([]);
    expect(ids(coincidencias([a, b], []))).toEqual(['ana', 'beto']);
  });

  it('cada segmento filtra por su regla', () => {
    expect(cumpleSegmento(a, 'recurrentes', corte)).toBe(true);
    expect(cumpleSegmento(b, 'recurrentes', corte)).toBe(false);
    expect(cumpleSegmento(b, 'nuevos', corte)).toBe(true);
    expect(cumpleSegmento(a, 'nuevos', corte)).toBe(false);
    expect(cumpleSegmento(b, 'sin_pedidos', corte)).toBe(true);
    expect(cumpleSegmento(a, 'con_puntos', corte)).toBe(true);
    expect(cumpleSegmento(b, 'todos', corte)).toBe(true);
  });

  it('contarSegmentos cuenta todos los segmentos', () => {
    expect(contarSegmentos(coincidencias([a, b], []), corte)).toEqual({
      todos: 2,
      recurrentes: 1,
      nuevos: 1,
      sin_pedidos: 1,
      con_puntos: 1,
    });
  });
});

describe('ordenar', () => {
  const x = fila('x', { nombre: 'Zoe', puntos_actuales: 5 }, [
    { total: 100, created_at: '2026-10-01T00:00:00.000Z' },
  ]);
  const y = fila(
    'y',
    {
      nombre: 'Ana',
      puntos_actuales: 90,
      created_at: '2026-06-01T00:00:00.000Z',
    },
    [
      { total: 50, created_at: '2026-10-10T00:00:00.000Z' },
      { total: 50, created_at: '2026-10-11T00:00:00.000Z' },
    ],
  );
  const z = fila('z', {
    nombre: 'Mia',
    created_at: '2026-09-01T00:00:00.000Z',
  });
  const lista = (puntos = 0): Coincidencia[] => [
    { fila: x, puntos },
    { fila: y, puntos },
    { fila: z, puntos },
  ];

  it.each([
    ['nombre', ['y', 'z', 'x']],
    ['pedidos', ['y', 'x', 'z']],
    // x e y gastaron lo mismo: desempata el cliente más reciente.
    ['gasto', ['y', 'x', 'z']],
    ['puntos', ['y', 'x', 'z']],
    ['ultimo', ['y', 'x', 'z']],
    ['recientes', ['z', 'y', 'x']],
  ] as const)('por %s', (orden, esperado) => {
    const l = lista();
    ordenar(l, orden, false);
    expect(ids(l)).toEqual(esperado);
  });

  it('auto con texto ordena por relevancia; sin texto, por reciente', () => {
    const relevancia: Coincidencia[] = [
      { fila: x, puntos: 10 },
      { fila: y, puntos: 100 },
      { fila: z, puntos: 50 },
    ];
    ordenar(relevancia, 'auto', true);
    expect(ids(relevancia)).toEqual(['y', 'z', 'x']);

    const sinTexto = lista();
    ordenar(sinTexto, 'auto', false);
    expect(ids(sinTexto)).toEqual(['z', 'y', 'x']);
  });
});

describe('métricas por cliente', () => {
  it('suma pedidos, gasto y el último pedido; ignora los sin cliente', () => {
    const metricas = metricasDePedidos([
      { cliente_id: 'c-1', total: 100, created_at: '2026-10-02T00:00:00.000Z' },
      { cliente_id: 'c-1', total: 50, created_at: '2026-10-05T00:00:00.000Z' },
      { cliente_id: 'c-1', total: 25, created_at: '2026-10-01T00:00:00.000Z' },
      { cliente_id: null, total: 999, created_at: '2026-10-09T00:00:00.000Z' },
    ]);

    expect(metricas.size).toBe(1);
    expect(metricas.get('c-1')).toEqual({
      n: 3,
      gastado: 175,
      ultimo: '2026-10-05T00:00:00.000Z',
    });
  });

  it('un cliente sin pedidos queda en cero y sin puntos nulos', () => {
    const [sinPedidos] = filasDeDirectorio(
      [cliente('c-2', { puntos_actuales: null })],
      [],
    );

    expect(sinPedidos).toMatchObject({
      puntos_actuales: 0,
      total_pedidos: 0,
      total_gastado: 0,
      ultimo_pedido: null,
    });
  });
});

describe('paginar', () => {
  it('limita la página pedida al rango válido', () => {
    expect(paginar(50, 24, 2)).toEqual({ pagina: 2, paginas: 3, desde: 24 });
    expect(paginar(50, 24, 99)).toEqual({ pagina: 3, paginas: 3, desde: 48 });
    expect(paginar(50, 24, -4)).toEqual({ pagina: 1, paginas: 3, desde: 0 });
    expect(paginar(0, 24, 1)).toEqual({ pagina: 1, paginas: 1, desde: 0 });
  });
});

describe('armarDirectorio', () => {
  const filas = Array.from({ length: 30 }, (_, i) =>
    fila(`c-${String(i).padStart(2, '0')}`, {
      nombre: `Cliente ${i}`,
      created_at: new Date(AHORA - (i + 1) * MS_POR_DIA).toISOString(),
      puntos_actuales: i % 2 === 0 ? 10 : 0,
    }),
  );

  it('pagina, cuenta y resume toda la base', () => {
    const dto = armarDirectorio(
      filas,
      { por_pagina: '10', pagina: '2' },
      AHORA,
    );

    expect(dto.items).toHaveLength(10);
    expect(dto).toMatchObject({
      total: 30,
      pagina: 2,
      por_pagina: 10,
      paginas: 3,
      resumen: {
        clientes: 30,
        con_pedidos: 0,
        nuevos_30d: 30,
        puntos_total: 150,
      },
      conteos: { todos: 30, con_puntos: 15, sin_pedidos: 30 },
    });
  });

  it('el segmento filtra los items pero no los conteos', () => {
    const dto = armarDirectorio(filas, { segmento: 'con_puntos' }, AHORA);

    expect(dto.total).toBe(15);
    expect(dto.conteos.todos).toBe(30);
  });

  it('un segmento, un orden o un tamaño de página inválidos usan el defecto', () => {
    const dto = armarDirectorio(
      filas,
      { segmento: 'x', orden: 'y', por_pagina: '9999' },
      AHORA,
    );

    expect(dto.total).toBe(30);
    expect(dto.por_pagina).toBe(60);
    expect(dto.items[0].id).toBe('c-00');
  });

  it('la búsqueda filtra los items y los conteos', () => {
    const dto = armarDirectorio(filas, { q: 'cliente 7' }, AHORA);

    expect(dto.items.map((i) => i.id)).toEqual(['c-07']);
    expect(dto.conteos.todos).toBe(1);
  });

  it('los items salen sin los campos internos de búsqueda', () => {
    const [item] = armarDirectorio(filas, {}, AHORA).items;

    expect(Object.keys(item).some((k) => k.startsWith('_'))).toBe(false);
  });
});
