import { validarObjeto } from '../common/validacion';
import {
  ESQUEMA_LOTE_GOOGLE_ADS,
  aNumero,
  motivoRechazoLote,
  normalizarFilas,
  soloDigitos,
} from './google-ads-normalizar';
import type { LoteGoogleAds } from './google-ads.tipos';

const LOTE: LoteGoogleAds = {
  version: 1,
  cuenta_id: '588-389-5578',
  zona_horaria: 'America/Bogota',
  moneda: 'COP',
  lote_id: '7c3f0a5e-8b1d-4c2a-9f6e-1a2b3c4d5e6f',
  reporte: 'campanas',
  parte: 1,
  total_partes: 1,
  desde: '2026-11-16',
  hasta: '2026-11-22',
  filas: [],
};

const CAMPANA = {
  fecha: '2026-11-22',
  campana_id: '23001',
  campana_nombre: 'Búsqueda - Pizza Riohacha',
  estado: 'ENABLED',
  estado_principal: 'ELIGIBLE',
  motivos_estado: [],
  estrategia_puja: 'MAXIMIZE_CLICKS',
  estado_puja: null,
  presupuesto_diario: '10000000000',
  gasto: '8500000000',
  impresiones: '420',
  clics: 31,
  conversiones: 1.5,
  valor_conversiones: 48000,
  llamadas: '2',
  is_busqueda: 0.0999,
  is_perdida_presupuesto: '0.35',
  is_perdida_ranking: 0.5,
  is_superior: null,
  is_superior_absoluta: null,
};

describe('esquema de la cabecera del lote', () => {
  it('acepta un lote válido', () => {
    expect(validarObjeto(ESQUEMA_LOTE_GOOGLE_ADS, LOTE)).toEqual([]);
  });

  it('rechaza versión desconocida, reporte inválido y lote_id que no es uuid', () => {
    const errores = validarObjeto(ESQUEMA_LOTE_GOOGLE_ADS, {
      ...LOTE,
      version: 2,
      reporte: 'subastas',
      lote_id: 'x',
    });
    expect(errores.map((e) => e.campo).sort()).toEqual([
      'lote_id',
      'reporte',
      'version',
    ]);
  });

  it('rechaza un campo desconocido', () => {
    const errores = validarObjeto(ESQUEMA_LOTE_GOOGLE_ADS, {
      ...LOTE,
      extra: 1,
    });
    expect(errores).toEqual([expect.objectContaining({ campo: 'extra' })]);
  });
});

describe('normalizarFilas', () => {
  it('convierte micros a pesos y los int64 en texto a número', () => {
    const { filas, errores } = normalizarFilas('campanas', [CAMPANA]);
    expect(errores).toEqual([]);
    expect(filas[0]).toMatchObject({
      presupuesto_diario: 10000,
      gasto: 8500,
      impresiones: 420,
      llamadas: 2,
      is_busqueda: 0.0999,
      is_perdida_presupuesto: 0.35,
      is_superior: null,
      estado_puja: null,
    });
  });

  it('reporta la fila con un campo desconocido o un número inválido', () => {
    const { filas, errores } = normalizarFilas('campanas', [
      CAMPANA,
      { ...CAMPANA, extra: 'x' },
      { ...CAMPANA, clics: 'muchos' },
    ]);
    expect(filas).toHaveLength(1);
    expect(errores.map((e) => e.campo)).toEqual([
      'filas[1].extra',
      'filas[2].clics',
    ]);
  });

  it('rechaza una fracción fuera de 0..1 y un id no numérico', () => {
    const { errores } = normalizarFilas('campanas', [
      { ...CAMPANA, is_busqueda: 1.2, campana_id: 'abc' },
    ]);
    expect(errores.map((e) => e.campo).sort()).toEqual([
      'filas[0].campana_id',
      'filas[0].is_busqueda',
    ]);
  });

  it('valida la dimensión de los segmentos', () => {
    const base = {
      fecha: '2026-11-22',
      campana_id: '23001',
      clave: '18',
      gasto: 0,
      impresiones: 0,
      clics: 0,
      conversiones: 0,
    };
    expect(
      normalizarFilas('segmentos', [{ ...base, dimension: 'hora' }]).errores,
    ).toEqual([]);
    expect(
      normalizarFilas('segmentos', [{ ...base, dimension: 'edad' }]).errores,
    ).toHaveLength(1);
  });

  it('acepta anuncios sin fecha con sus URLs', () => {
    const { filas, errores } = normalizarFilas('anuncios', [
      {
        grupo_id: '1',
        anuncio_id: '2',
        campana_id: '3',
        tipo: 'RESPONSIVE_SEARCH_AD',
        estado: 'ENABLED',
        fuerza: 'GOOD',
        aprobacion: 'APPROVED',
        urls_finales: ['https://pizzeriahorebs.shop/'],
      },
    ]);
    expect(errores).toEqual([]);
    expect(filas[0]).toMatchObject({
      urls_finales: ['https://pizzeriahorebs.shop/'],
    });
  });

  it('acepta cambios de la cuenta con campaña opcional', () => {
    const { errores } = normalizarFilas('cambios', [
      {
        recurso_cambio: 'customers/5883895578/changeEvents/abc~1',
        fecha: '2026-11-22',
        momento: '2026-11-22 18:03:11.123456',
        campana_id: null,
        tipo_recurso: 'CAMPAIGN_BUDGET',
        operacion: 'UPDATE',
        campos: ['amount_micros'],
      },
    ]);
    expect(errores).toEqual([]);
  });

  it('limita la cantidad de errores reportados', () => {
    const malas = Array.from({ length: 20 }, () => ({ fecha: 'x' }));
    expect(
      normalizarFilas('terminos', malas).errores.length,
    ).toBeLessThanOrEqual(5);
  });
});

describe('motivoRechazoLote', () => {
  it('acepta la cuenta con o sin guiones', () => {
    expect(motivoRechazoLote(LOTE, '5883895578')).toBeNull();
  });

  it('rechaza otra cuenta, otra zona horaria u otra moneda', () => {
    expect(motivoRechazoLote(LOTE, '2037167900')).toBe('cuenta');
    expect(
      motivoRechazoLote(
        { ...LOTE, zona_horaria: 'America/New_York' },
        '5883895578',
      ),
    ).toBe('zona_horaria');
    expect(motivoRechazoLote({ ...LOTE, moneda: 'USD' }, '5883895578')).toBe(
      'moneda',
    );
  });

  it('exige rango de fechas salvo en anuncios', () => {
    expect(motivoRechazoLote({ ...LOTE, desde: null }, '5883895578')).toBe(
      'rango',
    );
    expect(
      motivoRechazoLote(
        { ...LOTE, desde: '2026-11-23', hasta: '2026-11-22' },
        '5883895578',
      ),
    ).toBe('rango');
    expect(
      motivoRechazoLote(
        { ...LOTE, reporte: 'anuncios', desde: null, hasta: null },
        '5883895578',
      ),
    ).toBeNull();
  });

  it('rechaza parte mayor que el total y demasiadas filas', () => {
    expect(
      motivoRechazoLote({ ...LOTE, parte: 3, total_partes: 2 }, '5883895578'),
    ).toBe('partes');
    expect(
      motivoRechazoLote(
        { ...LOTE, filas: new Array(2001).fill({}) },
        '5883895578',
      ),
    ).toBe('filas');
  });
});

describe('ayudas', () => {
  it('aNumero acepta texto numérico y descarta lo demás', () => {
    expect(aNumero('42')).toBe(42);
    expect(aNumero(1.5)).toBe(1.5);
    expect(aNumero('')).toBeNull();
    expect(aNumero('x')).toBeNull();
    expect(aNumero(Infinity)).toBeNull();
  });

  it('soloDigitos limpia la cuenta', () => {
    expect(soloDigitos('588-389-5578')).toBe('5883895578');
  });
});
