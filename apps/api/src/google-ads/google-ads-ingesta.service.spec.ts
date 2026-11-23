import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { SupabaseService } from '../supabase/supabase.service';
import { firmaGoogleAds } from './google-ads-firma';
import { GoogleAdsIngestaService } from './google-ads-ingesta.service';

type Llamada = { tabla: string; op: string; args: unknown[] };

/** Cliente de Supabase falso que anota cada operación encadenada. */
function clienteFalso(repetido = false) {
  const llamadas: Llamada[] = [];
  const from = (tabla: string) => {
    const cadena: Record<string, unknown> = {};
    const anotar =
      (op: string) =>
      (...args: unknown[]) => {
        llamadas.push({ tabla, op, args });
        return cadena;
      };
    for (const op of ['select', 'eq', 'delete', 'gte', 'lte', 'not']) {
      // `op` sale de la lista fija de arriba, no de afuera.
      // eslint-disable-next-line security/detect-object-injection
      cadena[op] = anotar(op);
    }
    cadena.maybeSingle = () =>
      Promise.resolve({
        data: repetido ? { lote_id: 'x' } : null,
        error: null,
      });
    cadena.upsert = (...args: unknown[]) => {
      llamadas.push({ tabla, op: 'upsert', args });
      return Promise.resolve({ error: null });
    };
    cadena.insert = (...args: unknown[]) => {
      llamadas.push({ tabla, op: 'insert', args });
      return Promise.resolve({ error: null });
    };
    cadena.then = (resolver: (v: unknown) => void) => resolver({ error: null });
    return cadena;
  };
  return { llamadas, cliente: { from } };
}

function crear(
  opciones: { repetido?: boolean; env?: Record<string, string> } = {},
) {
  const env = opciones.env ?? {
    GOOGLE_ADS_WEBHOOK_SECRETO: 's',
    GOOGLE_ADS_CUENTA_ID: '5883895578',
  };
  const config = { get: (k: string) => new Map(Object.entries(env)).get(k) };
  const { llamadas, cliente } = clienteFalso(opciones.repetido);
  const servicio = new GoogleAdsIngestaService(
    config as unknown as ConfigService,
    { getClient: () => cliente } as unknown as SupabaseService,
  );
  return { servicio, llamadas };
}

const TERMINO = {
  fecha: '2026-11-22',
  campana_id: '1',
  grupo_id: '2',
  termino: 'pizza a domicilio riohacha',
  estado: 'NONE',
  gasto: '1500000000',
  impresiones: '10',
  clics: '2',
  conversiones: 0,
};

const LOTE = {
  version: 1,
  cuenta_id: '588-389-5578',
  zona_horaria: 'America/Bogota',
  moneda: 'COP',
  lote_id: '7c3f0a5e-8b1d-4c2a-9f6e-1a2b3c4d5e6f',
  reporte: 'terminos',
  parte: 1,
  total_partes: 2,
  desde: '2026-11-16',
  hasta: '2026-11-22',
  filas: [TERMINO],
};

describe('GoogleAdsIngestaService', () => {
  it('la parte 1 vacía la ventana y luego guarda (no quedan términos viejos)', async () => {
    const { servicio, llamadas } = crear();

    const r = await servicio.recibir(LOTE);

    expect(r).toMatchObject({ estado: 'guardado', filas: 1 });
    const ops = llamadas
      .filter((l) => l.tabla === 'google_ads_terminos_diario')
      .map((l) => l.op);
    expect(ops).toEqual(['delete', 'gte', 'lte', 'upsert']);
    const upsert = llamadas.find((l) => l.op === 'upsert');
    expect((upsert?.args[0] as { gasto: number }[])[0].gasto).toBe(1500);
    expect(
      llamadas.some((l) => l.tabla === 'google_ads_lotes' && l.op === 'insert'),
    ).toBe(true);
  });

  it('la parte 2 agrega sin borrar lo que dejó la parte 1', async () => {
    const { servicio, llamadas } = crear();

    await servicio.recibir({ ...LOTE, parte: 2 });

    expect(llamadas.some((l) => l.op === 'delete')).toBe(false);
  });

  it('un lote ya recibido no se vuelve a procesar', async () => {
    const { servicio, llamadas } = crear({ repetido: true });

    const r = await servicio.recibir(LOTE);

    expect(r.estado).toBe('repetido');
    expect(llamadas.some((l) => l.op === 'delete' || l.op === 'upsert')).toBe(
      false,
    );
  });

  it('los anuncios son una foto: se reemplazan completos', async () => {
    const { servicio, llamadas } = crear();

    await servicio.recibir({
      ...LOTE,
      reporte: 'anuncios',
      desde: null,
      hasta: null,
      total_partes: 1,
      filas: [
        {
          grupo_id: '2',
          anuncio_id: '3',
          campana_id: '1',
          tipo: 'RESPONSIVE_SEARCH_AD',
          estado: 'ENABLED',
          fuerza: 'GOOD',
          aprobacion: 'APPROVED',
          urls_finales: ['https://pizzeriahorebs.shop/'],
        },
      ],
    });

    const ops = llamadas
      .filter((l) => l.tabla === 'google_ads_anuncios')
      .map((l) => l.op);
    expect(ops).toEqual(['delete', 'not', 'upsert']);
  });

  it('rechaza filas fuera del rango del lote', async () => {
    const { servicio } = crear();
    await expect(
      servicio.recibir({
        ...LOTE,
        filas: [{ ...TERMINO, fecha: '2026-11-01' }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza una fila inválida sin escribir nada', async () => {
    const { servicio, llamadas } = crear();
    await expect(
      servicio.recibir({ ...LOTE, filas: [{ ...TERMINO, clics: 'x' }] }),
    ).rejects.toThrow(BadRequestException);
    expect(llamadas.some((l) => l.op === 'delete' || l.op === 'upsert')).toBe(
      false,
    );
  });

  it('rechaza otra cuenta', async () => {
    const { servicio } = crear();
    await expect(
      servicio.recibir({ ...LOTE, cuenta_id: '203-716-7900' }),
    ).rejects.toThrow('La cuenta de Google Ads no es la del negocio.');
  });

  it('sin configuración responde 503', async () => {
    const { servicio } = crear({ env: {} });
    await expect(servicio.recibir(LOTE)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('firmaValida usa el secreto configurado y la hora actual', () => {
    const { servicio } = crear();
    const body = Buffer.from('{}');
    const t = String(Math.floor(Date.now() / 1000));
    expect(
      servicio.firmaValida(body, `t=${t},v1=${firmaGoogleAds(body, t, 's')}`),
    ).toBe(true);
    expect(servicio.firmaValida(body, `t=${t},v1=${'0'.repeat(64)}`)).toBe(
      false,
    );
  });

  it('sin secreto ninguna firma es válida', () => {
    const { servicio } = crear({ env: { GOOGLE_ADS_CUENTA_ID: '1' } });
    const body = Buffer.from('{}');
    const t = String(Math.floor(Date.now() / 1000));
    expect(
      servicio.firmaValida(body, `t=${t},v1=${firmaGoogleAds(body, t, '')}`),
    ).toBe(false);
  });
});
