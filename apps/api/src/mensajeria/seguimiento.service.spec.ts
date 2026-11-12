import { SeguimientoService } from './seguimiento.service';
import type { ConversacionParaSeguimiento } from './conversaciones.service';

const AHORA_ABIERTO = new Date('2026-10-31T21:00:00.000Z'); // 4:00 p.m. en Bogotá
const HACE_2_HORAS = new Date('2026-10-31T19:00:00.000Z').toISOString();
const HACE_25_HORAS = new Date('2026-10-30T20:00:00.000Z').toISOString();

function conversacion(
  id: string,
  canal = 'whatsapp',
  telefono?: string,
  ultimaInteraccion = HACE_2_HORAS,
): ConversacionParaSeguimiento {
  return {
    id,
    canal,
    identificador_externo: canal === 'whatsapp' ? `57300${id}` : `psid-${id}`,
    telefono,
    ultima_interaccion: ultimaInteraccion,
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
  const avisoEquipo = {
    notificar: jest.fn(),
    notificarVentanaCerrada: jest.fn(),
  };
  const servicio = new SeguimientoService(
    conversaciones as never,
    metaGraph as never,
    pedidos as never,
    avisoEquipo as never,
  );
  return { servicio, conversaciones, metaGraph, pedidos, avisoEquipo };
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
      expect.stringContaining('Sigues interesado'),
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
      false,
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
      true,
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

  it('en Messenger/Instagram busca compra por telefono y cierra seguimiento', async () => {
    const c = conversacion('30', 'messenger', '3001234567');
    const { servicio, metaGraph, conversaciones, pedidos } = armar({
      inactivas: [c],
      yaComproPorId: ['3001234567'],
    });
    await servicio.ejecutar();
    expect(pedidos.tienePedidoReciente).toHaveBeenCalledWith('3001234567', 24);
    expect(metaGraph.enviarMensajeSesion).not.toHaveBeenCalled();
    expect(conversaciones.marcarSeguimientoEnviado).toHaveBeenCalledWith(
      'messenger',
      c.identificador_externo,
      'oferta_enviada',
    );
  });

  it('en Messenger/Instagram fuera de ventana de 24h avisa al equipo y no llama a Meta', async () => {
    const c = conversacion('31', 'instagram', '3007654321', HACE_25_HORAS);
    const { servicio, metaGraph, conversaciones, avisoEquipo } = armar({
      inactivas: [c],
    });
    await servicio.ejecutar();
    expect(metaGraph.enviarMensajeSesion).not.toHaveBeenCalled();
    expect(avisoEquipo.notificarVentanaCerrada).toHaveBeenCalledWith(
      expect.objectContaining({
        canal: 'instagram',
        identificadorExterno: c.identificador_externo,
        telefono: '3007654321',
      }),
    );
    expect(conversaciones.marcarSeguimientoEnviado).toHaveBeenCalledWith(
      'instagram',
      c.identificador_externo,
      'oferta_enviada',
    );
  });

  it('en Messenger/Instagram dentro de ventana de 24h envía normal', async () => {
    const c = conversacion('32', 'messenger', '3007654321', HACE_2_HORAS);
    const { servicio, metaGraph, conversaciones } = armar({
      inactivas: [c],
    });
    await servicio.ejecutar();
    expect(metaGraph.enviarMensajeSesion).toHaveBeenCalledWith(
      'messenger',
      c.identificador_externo,
      expect.stringContaining('Sigues interesado'),
    );
    expect(conversaciones.marcarSeguimientoEnviado).toHaveBeenCalledWith(
      'messenger',
      c.identificador_externo,
      'recordatorio_enviado',
      false,
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
      false,
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
