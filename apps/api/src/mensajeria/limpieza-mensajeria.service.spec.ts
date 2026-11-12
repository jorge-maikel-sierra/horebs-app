import {
  LimpiezaMensajeriaService,
  limiteRetencion,
} from './limpieza-mensajeria.service';

describe('LimpiezaMensajeriaService', () => {
  it('el límite es 30 días antes de ahora', () => {
    expect(limiteRetencion(new Date('2026-11-30T09:00:00.000Z'))).toBe(
      '2026-10-31T09:00:00.000Z',
    );
  });

  it('borra los ids viejos y no lanza si la base falla', async () => {
    const lt = jest
      .fn()
      .mockResolvedValueOnce({ error: null, count: 3 })
      .mockResolvedValueOnce({ error: { code: '500', message: 'caída' } });
    const supabase = {
      getClient: () => ({ from: () => ({ delete: () => ({ lt }) }) }),
    };
    const servicio = new LimpiezaMensajeriaService(supabase as never);

    await servicio.limpiar();
    await expect(servicio.limpiar()).resolves.toBeUndefined();
    expect(lt).toHaveBeenCalledWith('procesado_en', expect.any(String));
  });
});
