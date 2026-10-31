import { SeguimientoService } from './seguimiento.service';
import type { ConversacionParaSeguimiento } from './conversaciones.service';

const AHORA_ABIERTO = new Date('2026-10-31T21:00:00.000Z'); // 4:00 p.m. en Bogotá

function conversacion(
  id: string,
  canal = 'whatsapp',
): ConversacionParaSeguimiento {
  return {
    id,
    canal,
    identificador_externo: `57300${id}`,
  } as ConversacionParaSeguimiento;
}

function armar(opciones: {
  inactivas?: ConversacionParaSeguimiento[];
  vencidas?: ConversacionParaSeguimiento[];
  yaComproPorId?: string[];
  fallaEnvioPara?: string;
}) {
  const conversaciones = {
    obtenerConfiguracionSeguimiento: jest
      .fn()
      .mockResolvedValue({ recordatorioMinutos: 60, ofertaMinutos: 180 }),
    buscarInactivasSinSeguimiento: jest
      .fn()
      .mockResolvedValue(opciones.inactivas ?? []),
    buscarConRecordatorioVencido: jest
      .fn()
      .mockResolvedValue(opciones.vencidas ?? []),
    registrarMensaje: jest.fn().mockResolvedValue(undefined),
    marcarSeguimientoEnviado: jest.fn().mockResolvedValue(undefined),
  };
  const metaGraph = {
    enviarMensajeSesion: jest.fn((canal: string, id: string) =>
      id === opciones.fallaEnvioPara
        ? Promise.reject(new Error('Meta caído'))
        : Promise.resolve(),
    ),
  };
  const pedidos = {
    tienePedidoReciente: jest.fn((id: string) =>
      Promise.resolve(opciones.yaComproPorId?.includes(id) ?? false),
    ),
  };
  const avisosPedido = {
    enviarRecompras: jest.fn().mockResolvedValue(undefined),
  };
  const servicio = new SeguimientoService(
    conversaciones as never,
    metaGraph as never,
    pedidos as never,
    avisosPedido as never,
  );
  return { servicio, conversaciones, metaGraph, pedidos, avisosPedido };
}

describe('SeguimientoService.ejecutar', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(AHORA_ABIERTO);
  });
  afterEach(() => jest.useRealTimers());

  it('manda el recordatorio, lo registra y marca la etapa', async () => {
    const c = conversacion('1');
    const { servicio, metaGraph, conversaciones } = armar({ inactivas: [c] });
    await servicio.ejecutar();
    expect(metaGraph.enviarMensajeSesion).toHaveBeenCalledWith(
      'whatsapp',
      c.identificador_externo,
      expect.stringContaining('Seguís interesado'),
    );
    expect(conversaciones.registrarMensaje).toHaveBeenCalledWith(
      '1',
      'saliente_bot',
      expect.any(String),
    );
    expect(conversaciones.marcarSeguimientoEnviado).toHaveBeenCalledWith(
      'whatsapp',
      c.identificador_externo,
      'recordatorio_enviado',
    );
  });

  it('manda la oferta con el 10% confirmado y marca la etapa', async () => {
    const c = conversacion('2');
    const { servicio, metaGraph, conversaciones } = armar({ vencidas: [c] });
    await servicio.ejecutar();
    expect(metaGraph.enviarMensajeSesion).toHaveBeenCalledWith(
      'whatsapp',
      c.identificador_externo,
      expect.stringContaining('10% de descuento'),
    );
    expect(conversaciones.marcarSeguimientoEnviado).toHaveBeenCalledWith(
      'whatsapp',
      c.identificador_externo,
      'oferta_enviada',
    );
  });

  it('a quien ya compró no le escribe y cierra su seguimiento', async () => {
    const c = conversacion('3');
    const { servicio, metaGraph, conversaciones } = armar({
      inactivas: [c],
      yaComproPorId: [c.identificador_externo],
    });
    await servicio.ejecutar();
    expect(metaGraph.enviarMensajeSesion).not.toHaveBeenCalled();
    expect(conversaciones.marcarSeguimientoEnviado).toHaveBeenCalledWith(
      'whatsapp',
      c.identificador_externo,
      'oferta_enviada',
    );
  });

  it('un error con una conversación no corta a las siguientes', async () => {
    const mala = conversacion('4');
    const buena = conversacion('5');
    const { servicio, metaGraph, conversaciones } = armar({
      inactivas: [mala, buena],
      fallaEnvioPara: mala.identificador_externo,
    });
    await servicio.ejecutar();
    expect(metaGraph.enviarMensajeSesion).toHaveBeenCalledTimes(2);
    expect(conversaciones.marcarSeguimientoEnviado).toHaveBeenCalledTimes(1);
    expect(conversaciones.marcarSeguimientoEnviado).toHaveBeenCalledWith(
      'whatsapp',
      buena.identificador_externo,
      'recordatorio_enviado',
    );
  });

  it('con el bot cerrado no manda nada', async () => {
    jest.setSystemTime(new Date('2026-10-31T08:00:00.000Z')); // 3:00 a.m. en Bogotá
    const { servicio, metaGraph, conversaciones } = armar({
      inactivas: [conversacion('6')],
    });
    await servicio.ejecutar();
    expect(
      conversaciones.obtenerConfiguracionSeguimiento,
    ).not.toHaveBeenCalled();
    expect(metaGraph.enviarMensajeSesion).not.toHaveBeenCalled();
  });
});
