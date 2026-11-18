import {
  cuerpoCrearAudiencia,
  cuerpoCrearParecido,
  cuerposReemplazo,
  MAX_POR_LLAMADA,
  urlCrearAudiencia,
  urlReemplazarUsuarios,
} from './audiencias-meta';

describe('urls', () => {
  it('apuntan a la cuenta y al público, con o sin el prefijo act_', () => {
    expect(urlCrearAudiencia('123')).toBe(
      'https://graph.facebook.com/v21.0/act_123/customaudiences',
    );
    expect(urlReemplazarUsuarios('999')).toBe(
      'https://graph.facebook.com/v21.0/999/usersreplace',
    );
  });
});

describe('cuerpoCrearAudiencia', () => {
  it('es una lista de clientes aportada por el negocio', () => {
    expect(cuerpoCrearAudiencia('Horebs · X', 'desc')).toEqual({
      name: 'Horebs · X',
      description: 'desc',
      subtype: 'CUSTOM',
      customer_file_source: 'USER_PROVIDED_ONLY',
    });
  });
});

describe('cuerpoCrearParecido', () => {
  it('pide el 1% de Colombia a partir del público de origen', () => {
    const c = cuerpoCrearParecido('Parecido', 'o-1');
    expect(c).toMatchObject({
      subtype: 'LOOKALIKE',
      origin_audience_id: 'o-1',
    });
    expect(JSON.parse(c.lookalike_spec as string)).toEqual({
      type: 'similarity',
      country: 'CO',
      ratio: 0.01,
    });
  });
});

describe('cuerposReemplazo', () => {
  const fila = (i: number) => [String(i)];

  it('una sola llamada cuando cabe, marcada como la última', () => {
    const [c] = cuerposReemplazo([fila(1), fila(2)], 7);
    expect(c).toMatchObject({
      session: {
        session_id: 7,
        batch_seq: 1,
        last_batch_flag: true,
        estimated_num_total: 2,
      },
    });
  });

  it('parte en lotes de 10.000 y solo el último cierra la sesión', () => {
    const filas = Array.from({ length: MAX_POR_LLAMADA + 5 }, (_, i) =>
      fila(i),
    );
    const cuerpos = cuerposReemplazo(filas, 7);
    expect(cuerpos).toHaveLength(2);
    expect(
      cuerpos.map(
        (c) => (c.session as { last_batch_flag: boolean }).last_batch_flag,
      ),
    ).toEqual([false, true]);
    expect(
      cuerpos.map((c) => (c.session as { batch_seq: number }).batch_seq),
    ).toEqual([1, 2]);
  });
});
