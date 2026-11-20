import type { SupabaseService } from '../supabase/supabase.service';
import { InteresProductoService } from './interes-producto.service';

function crear(conteos: Record<string, number>) {
  const porTabla = new Map(Object.entries(conteos));
  const cliente = {
    from: (tabla: string) => {
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.eq = () => q;
      q.gte = () =>
        Promise.resolve({ count: porTabla.get(tabla) ?? 0, error: null });
      return q;
    },
  };
  return new InteresProductoService({
    getClient: () => cliente,
  } as unknown as SupabaseService);
}

describe('InteresProductoService.atendidoDesde', () => {
  const DESDE = '2026-11-18T21:00:00.000Z';

  it('sin pedido ni mensaje del equipo, todavía no lo atendieron', async () => {
    await expect(crear({}).atendidoDesde('cv-1', DESDE)).resolves.toBe(false);
  });

  it('si una persona del equipo ya le escribió, cuenta como atendido', async () => {
    await expect(
      crear({ mensajes_conversacion: 3 }).atendidoDesde('cv-1', DESDE),
    ).resolves.toBe(true);
  });

  it('si pidió por el bot, también', async () => {
    await expect(
      crear({ pedidos: 1 }).atendidoDesde('cv-1', DESDE),
    ).resolves.toBe(true);
  });
});
