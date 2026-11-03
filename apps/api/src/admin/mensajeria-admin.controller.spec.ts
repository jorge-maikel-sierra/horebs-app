import type { MetaGraphService } from '../mensajeria/meta-graph.service';
import { MensajeriaAdminController } from './mensajeria-admin.controller';

describe('MensajeriaAdminController', () => {
  let controller: MensajeriaAdminController;
  let metaGraph: jest.Mocked<Pick<MetaGraphService, 'configurarPerfil'>>;

  beforeEach(() => {
    metaGraph = {
      configurarPerfil: jest.fn().mockResolvedValue(undefined),
    };
    controller = new MensajeriaAdminController(
      metaGraph as unknown as MetaGraphService,
    );
  });

  it('configura el perfil de messenger y retorna ok', async () => {
    const res = await controller.configurarPerfil('messenger', {});
    expect(res).toEqual({ ok: true, canal: 'messenger' });
    expect(metaGraph.configurarPerfil).toHaveBeenCalledWith('messenger');
  });

  it('configura el perfil de instagram y retorna ok', async () => {
    const res = await controller.configurarPerfil('instagram', {});
    expect(res).toEqual({ ok: true, canal: 'instagram' });
    expect(metaGraph.configurarPerfil).toHaveBeenCalledWith('instagram');
  });
});
