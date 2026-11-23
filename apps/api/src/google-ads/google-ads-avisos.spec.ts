import type { AlertaDto } from './google-ads-alertas';
import { alertasParaAvisar, avisoDeAlertas } from './google-ads-avisos';
import type { TableroGoogleAdsDto } from './google-ads-tablero';

const alerta = (parcial: Partial<AlertaDto>): AlertaDto => ({
  codigo: 'SIN_SERVIR',
  severidad: 'critica',
  titulo: 'No sirve',
  detalle: 'Estado NOT_ELIGIBLE.',
  accion: 'Revisar.',
  ...parcial,
});

function tablero(
  alertas: AlertaDto[],
  ultimo: string | null = '2026-11-23T11:00:00Z',
): TableroGoogleAdsDto {
  return {
    alertas,
    sincronizacion: { ultimo_envio: ultimo, datos_hasta: null },
  } as unknown as TableroGoogleAdsDto;
}

describe('avisos de Google Ads', () => {
  it('solo avisa críticas y altas', () => {
    const t = tablero([
      alerta({}),
      alerta({ codigo: 'CPA_ALTO', severidad: 'alta' }),
      alerta({ codigo: 'QS_BAJO', severidad: 'media' }),
    ]);
    expect(alertasParaAvisar(t).map((a) => a.codigo)).toEqual([
      'SIN_SERVIR',
      'CPA_ALTO',
    ]);
  });

  it('no avisa "sin datos" mientras el script nunca se haya conectado', () => {
    const sinConexion = tablero(
      [alerta({ codigo: 'SINCRONIZACION_VIEJA', severidad: 'alta' })],
      null,
    );
    expect(avisoDeAlertas(sinConexion)).toBeNull();
    const vieja = tablero([
      alerta({ codigo: 'SINCRONIZACION_VIEJA', severidad: 'alta' }),
    ]);
    expect(avisoDeAlertas(vieja)?.asunto).toBe(
      'Google Ads: 1 alerta(s) que piden acción',
    );
  });

  it('sin alertas importantes no manda correo', () => {
    expect(avisoDeAlertas(tablero([alerta({ severidad: 'baja' })]))).toBeNull();
  });

  it('escapa en el HTML lo que viene de las búsquedas de Google', () => {
    const aviso = avisoDeAlertas(
      tablero([
        alerta({ detalle: '«<script>alert(1)</script>» sin conversiones.' }),
      ]),
    );
    expect(aviso?.html).not.toContain('<script>');
    expect(aviso?.html).toContain('&lt;script&gt;');
    expect(aviso?.texto).toContain(
      'https://pizzeriahorebs.shop/admin/google-ads',
    );
  });
});
