import type { MailService } from '../mail/mail.service';
import { GoogleAdsAvisosService } from './google-ads-avisos.service';
import type { GoogleAdsTableroService } from './google-ads-tablero.service';

function crear(tablero: () => Promise<unknown>) {
  const mail = { enviarAvisoEquipo: jest.fn() };
  const servicio = new GoogleAdsAvisosService(
    { tablero } as unknown as GoogleAdsTableroService,
    mail as unknown as MailService,
  );
  return { servicio, mail };
}

describe('GoogleAdsAvisosService', () => {
  it('manda el correo cuando hay una alerta crítica', async () => {
    const { servicio, mail } = crear(() =>
      Promise.resolve({
        sincronizacion: { ultimo_envio: '2026-11-23T11:00:00Z' },
        alertas: [
          {
            codigo: 'SIN_SERVIR',
            severidad: 'critica',
            titulo: 't',
            detalle: 'd',
            accion: 'a',
          },
        ],
      }),
    );
    await servicio.avisarCadaDia();
    expect(mail.enviarAvisoEquipo).toHaveBeenCalledTimes(1);
  });

  it('si falla la lectura no revienta ni manda nada', async () => {
    const { servicio, mail } = crear(() =>
      Promise.reject(new Error('sin base')),
    );
    await expect(servicio.avisarCadaDia()).resolves.toBeUndefined();
    expect(mail.enviarAvisoEquipo).not.toHaveBeenCalled();
  });
});
