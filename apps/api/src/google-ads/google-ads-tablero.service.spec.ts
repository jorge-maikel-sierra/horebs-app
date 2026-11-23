import { BadRequestException } from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service';
import { GoogleAdsTableroService } from './google-ads-tablero.service';

/** Cualquier consulta devuelve una lista vacía. */
function clienteVacio() {
  const cadena: Record<string, unknown> = {};
  const devolver = () => cadena;
  for (const op of [
    'from',
    'select',
    'gte',
    'lte',
    'order',
    'range',
    'limit',
  ]) {
    // eslint-disable-next-line security/detect-object-injection -- `op` sale de la lista fija.
    cadena[op] = devolver;
  }
  cadena.returns = () => Promise.resolve({ data: [], error: null });
  cadena.maybeSingle = () => Promise.resolve({ data: null, error: null });
  return cadena;
}

function crear() {
  return new GoogleAdsTableroService({
    getClient: () => clienteVacio(),
  } as unknown as SupabaseService);
}

describe('GoogleAdsTableroService', () => {
  it('por defecto toma 28 días hasta ayer', () => {
    const r = crear().resolverRango();
    expect(r.desde < r.hasta).toBe(true);
    const dias = (Date.parse(r.hasta) - Date.parse(r.desde)) / 86_400_000 + 1;
    expect(dias).toBe(28);
  });

  it('rechaza desde > hasta y rangos de más de 180 días', () => {
    expect(() => crear().resolverRango('2026-11-10', '2026-11-01')).toThrow(
      BadRequestException,
    );
    expect(() => crear().resolverRango('2026-01-01', '2026-11-01')).toThrow(
      'El rango no puede pasar de 180 días.',
    );
  });

  it('arma el tablero aunque no haya datos', async () => {
    const t = await crear().tablero('2026-11-01', '2026-11-07');
    expect(t).toMatchObject({ desde: '2026-11-01', hasta: '2026-11-07' });
    expect(t.anterior).toEqual({ desde: '2026-10-25', hasta: '2026-10-31' });
    expect(t.serie).toHaveLength(7);
  });
});
