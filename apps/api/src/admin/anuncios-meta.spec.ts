import {
  ACCION_CONVERSACION,
  cuentaPublicitaria,
  filaDeCreativo,
  filaDeInsight,
  filasDeInsights,
  urlCreativos,
  urlInsights,
  valorAccion,
} from './anuncios-meta';

describe('cuentaPublicitaria', () => {
  it('agrega el prefijo act_ solo si falta', () => {
    expect(cuentaPublicitaria('123')).toBe('act_123');
    expect(cuentaPublicitaria(' act_123 ')).toBe('act_123');
  });
});

describe('urlInsights', () => {
  it('pide un renglón por día y anuncio con frecuencia y acciones, sin el token en la URL', () => {
    const url = new URL(urlInsights('123', '2026-11-01', '2026-11-17'));
    expect(url.pathname).toBe('/v21.0/act_123/insights');
    expect(url.searchParams.get('level')).toBe('ad');
    expect(url.searchParams.get('time_increment')).toBe('1');
    expect(url.searchParams.get('fields')).toContain('frequency,actions');
    expect(url.searchParams.get('time_range')).toBe(
      '{"since":"2026-11-01","until":"2026-11-17"}',
    );
    expect(url.search).not.toContain('access_token');
  });
});

describe('urlCreativos', () => {
  it('pide la miniatura, el título y el texto del creativo de cada anuncio', () => {
    const url = new URL(urlCreativos('123'));
    expect(url.pathname).toBe('/v21.0/act_123/ads');
    expect(url.searchParams.get('fields')).toContain(
      '{thumbnail_url,title,body}',
    );
  });
});

describe('valorAccion', () => {
  it('suma solo el tipo pedido y tolera que falten acciones', () => {
    const acciones = [
      { action_type: ACCION_CONVERSACION, value: '4' },
      { action_type: 'link_click', value: '9' },
    ];
    expect(valorAccion(acciones, ACCION_CONVERSACION)).toBe(4);
    expect(valorAccion(undefined, ACCION_CONVERSACION)).toBe(0);
    expect(valorAccion([{ action_type: 'x', value: 'abc' }], 'x')).toBe(0);
  });
});

describe('filaDeInsight', () => {
  const base = {
    date_start: '2026-11-10',
    ad_id: 'a-1',
    ad_name: 'Pizza Horebs',
    campaign_id: 'c-1',
    campaign_name: 'Noviembre',
    spend: '12345.67',
    impressions: '1000',
    reach: '800',
    clicks: '42',
    frequency: '1.25',
    actions: [
      { action_type: ACCION_CONVERSACION, value: '3' },
      { action_type: 'link_click', value: '30' },
    ],
  };

  it('convierte los textos de Meta a números y separa conversaciones y clics', () => {
    expect(filaDeInsight(base)).toEqual({
      fecha: '2026-11-10',
      anuncio_id: 'a-1',
      anuncio_nombre: 'Pizza Horebs',
      campana_id: 'c-1',
      campana_nombre: 'Noviembre',
      gasto: 12345.67,
      impresiones: 1000,
      alcance: 800,
      clics: 42,
      frecuencia: 1.25,
      conversaciones: 3,
      clics_enlace: 30,
    });
  });

  it('un valor roto cuenta como 0 y no tira la fila', () => {
    const fila = filaDeInsight({
      ...base,
      spend: 'x',
      clicks: undefined,
      actions: undefined,
    });
    expect(fila?.gasto).toBe(0);
    expect(fila?.clics).toBe(0);
    expect(fila?.conversaciones).toBe(0);
  });

  it('descarta el renglón sin fecha, anuncio o campaña', () => {
    expect(filaDeInsight({ ...base, ad_id: undefined })).toBeNull();
    expect(
      filasDeInsights([base, { ...base, date_start: undefined }]),
    ).toHaveLength(1);
  });
});

describe('filaDeCreativo', () => {
  it('guarda el creativo con su miniatura', () => {
    expect(
      filaDeCreativo({
        id: 'a-1',
        name: 'Reel',
        effective_status: 'ACTIVE',
        creative: { thumbnail_url: 'https://x/y.jpg', title: 'T', body: 'B' },
      }),
    ).toEqual({
      anuncio_id: 'a-1',
      nombre: 'Reel',
      estado: 'ACTIVE',
      miniatura_url: 'https://x/y.jpg',
      titulo: 'T',
      texto: 'B',
    });
  });

  it('un anuncio sin creativo queda con campos nulos y sin id se descarta', () => {
    expect(filaDeCreativo({ id: 'a-2' })?.miniatura_url).toBeNull();
    expect(filaDeCreativo({ name: 'sin id' })).toBeNull();
  });
});
