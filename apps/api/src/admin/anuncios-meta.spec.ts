import {
  cuentaPublicitaria,
  filaDeInsight,
  filasDeInsights,
  urlInsights,
} from './anuncios-meta';

describe('cuentaPublicitaria', () => {
  it('agrega el prefijo act_ solo si falta', () => {
    expect(cuentaPublicitaria('123')).toBe('act_123');
    expect(cuentaPublicitaria(' act_123 ')).toBe('act_123');
  });
});

describe('urlInsights', () => {
  it('pide un renglón por día y anuncio, sin el token en la URL', () => {
    const url = new URL(urlInsights('123', '2026-11-01', '2026-11-17'));
    expect(url.pathname).toBe('/v21.0/act_123/insights');
    expect(url.searchParams.get('level')).toBe('ad');
    expect(url.searchParams.get('time_increment')).toBe('1');
    expect(url.searchParams.get('time_range')).toBe(
      '{"since":"2026-11-01","until":"2026-11-17"}',
    );
    expect(url.search).not.toContain('access_token');
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
  };

  it('convierte los textos de Meta a números', () => {
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
    });
  });

  it('un valor roto cuenta como 0 y no tira la fila', () => {
    const fila = filaDeInsight({ ...base, spend: 'x', clicks: undefined });
    expect(fila?.gasto).toBe(0);
    expect(fila?.clics).toBe(0);
  });

  it('descarta el renglón sin fecha, anuncio o campaña', () => {
    expect(filaDeInsight({ ...base, ad_id: undefined })).toBeNull();
    expect(
      filasDeInsights([base, { ...base, date_start: undefined }]),
    ).toHaveLength(1);
  });
});
