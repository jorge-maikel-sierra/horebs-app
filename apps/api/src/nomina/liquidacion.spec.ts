import { ConflictException, NotFoundException } from '@nestjs/common';
import { NominaService, type SemanaNominaDto } from './nomina.service';

const semana = { id: 's1', estado: 'liquidada' } as unknown as SemanaNominaDto;

function servicio() {
  const svc = Object.create(NominaService.prototype) as NominaService;
  const liquidar = jest.spyOn(svc, 'liquidar');
  const obtener = jest.spyOn(svc, 'obtenerSemana').mockResolvedValue(semana);
  return { svc, liquidar, obtener };
}

describe('NominaService.asegurarLiquidada (PUT idempotente)', () => {
  it('liquida la primera vez', async () => {
    const { svc, liquidar, obtener } = servicio();
    liquidar.mockResolvedValue(semana);
    await expect(svc.asegurarLiquidada('s1', 'u1', 'ok')).resolves.toBe(semana);
    expect(obtener).not.toHaveBeenCalled();
  });

  it('si ya estaba liquidada devuelve la existente, sin error', async () => {
    const { svc, liquidar, obtener } = servicio();
    liquidar.mockRejectedValue(new ConflictException('ya'));
    await expect(svc.asegurarLiquidada('s1', 'u1', undefined)).resolves.toBe(
      semana,
    );
    expect(obtener).toHaveBeenCalledWith('s1');
  });

  it('otros errores se propagan', async () => {
    const { svc, liquidar } = servicio();
    liquidar.mockRejectedValue(new NotFoundException('no existe'));
    await expect(
      svc.asegurarLiquidada('s1', 'u1', undefined),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
