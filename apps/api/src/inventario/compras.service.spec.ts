import { BadRequestException } from '@nestjs/common';
import { ComprasService } from './compras.service';

function servicio() {
  const svc = Object.create(ComprasService.prototype) as ComprasService;
  const vincular = jest.spyOn(svc, 'vincularInsumo').mockResolvedValue();
  const procesar = jest.spyOn(svc, 'procesarLinea').mockResolvedValue();
  const excluir = jest.spyOn(svc, 'excluirLinea').mockResolvedValue();
  return { svc, vincular, procesar, excluir };
}

describe('ComprasService.actualizarLinea', () => {
  it('sin insumo ni estado es 400', async () => {
    const { svc } = servicio();
    await expect(svc.actualizarLinea('d1', {}, 'u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('vincular y procesar: primero vincula, después procesa', async () => {
    const { svc, vincular, procesar } = servicio();
    const orden: string[] = [];
    vincular.mockImplementation(() => {
      orden.push('vincular');
      return Promise.resolve();
    });
    procesar.mockImplementation(() => {
      orden.push('procesar');
      return Promise.resolve();
    });
    await svc.actualizarLinea(
      'd1',
      { insumo_id: 'i1', estado: 'procesado' },
      'u1',
    );
    expect(orden).toEqual(['vincular', 'procesar']);
    expect(procesar).toHaveBeenCalledWith('d1', 'u1');
  });

  it('solo estado excluido excluye y no vincula', async () => {
    const { svc, vincular, excluir } = servicio();
    await svc.actualizarLinea('d1', { estado: 'excluido' }, 'u1');
    expect(excluir).toHaveBeenCalledWith('d1');
    expect(vincular).not.toHaveBeenCalled();
  });
});
