import { BadRequestException } from '@nestjs/common';
import { ConsultaMovimientosPipe } from './consulta-movimientos.pipe';

const UUID = '3f2b8c1e-9d4a-4e6b-8a1c-5d7e9f0a1b2c';

describe('ConsultaMovimientosPipe', () => {
  const pipe = new ConsultaMovimientosPipe();

  it('un query vacío no trae ningún filtro', async () => {
    await expect(pipe.transform({})).resolves.toEqual({
      insumoId: undefined,
      tipo: undefined,
      desde: undefined,
      hasta: undefined,
      limit: undefined,
    });
  });

  it('un query válido se convierte en filtros tipados', async () => {
    await expect(
      pipe.transform({
        insumoId: UUID,
        tipo: 'compra',
        desde: '2026-10-01',
        hasta: '2026-10-31',
        limit: '50',
      }),
    ).resolves.toEqual({
      insumoId: UUID,
      tipo: 'compra',
      desde: '2026-10-01',
      hasta: '2026-10-31',
      limit: 50,
    });
  });

  it.each([
    ['insumoId', { insumoId: 'no-es-uuid' }],
    ['desde', { desde: '31/10/2026' }],
    ['hasta', { hasta: '2026-02-30' }],
    ['limit', { limit: '0' }],
    ['limit', { limit: '201' }],
    ['limit', { limit: 'abc' }],
  ])('un %s inválido es 400', async (_campo, query) => {
    await expect(pipe.transform(query)).rejects.toThrow(BadRequestException);
  });
});
