import { AvisosPedidoService } from './avisos-pedido.service';
import type { PedidoParaAvisoDto } from '../pedidos/pedidos.tipos';

const HORA_MS = 60 * 60 * 1000;
const AHORA = new Date('2026-10-28T20:00:00Z');

function pedido(
  canal = 'whatsapp',
  estado = 'confirmado',
  telefono: string | null = '3187592616',
): PedidoParaAvisoDto {
  return {
    id: 'abcd1234-0000-0000-0000-000000000000',
    canal,
    estado,
    modalidad: 'domicilio',
    direccionEntrega: 'Carrera 7 # 17B - 66',
    telefono,
  };
}

function armar(opciones?: {
  pedido?: PedidoParaAvisoDto | null;
  ventana?: {
    conversacionId: string;
    estado: 'bot' | 'derivado';
    ultimaInteraccion: Date;
    identificadorExterno?: string;
  } | null;
}) {
  const defaultVentanaWa = {
    conversacionId: 'conv-wa-1',
    estado: 'bot' as const,
    ultimaInteraccion: new Date(AHORA.getTime() - HORA_MS),
  };
  const defaultVentanaSoc = {
    conversacionId: 'conv-soc-1',
    identificadorExterno: 'psid-user-1',
    estado: 'bot' as const,
    ultimaInteraccion: new Date(AHORA.getTime() - HORA_MS),
  };
  const pedidos = {
    datosParaAviso: jest.fn().mockResolvedValue(opciones?.pedido ?? pedido()),
  };
  const conversaciones = {
    obtenerVentana: jest
      .fn()
      .mockResolvedValue(
        opciones?.ventana !== undefined ? opciones.ventana : defaultVentanaWa,
      ),
    obtenerVentanaPorTelefono: jest
      .fn()
      .mockResolvedValue(
        opciones?.ventana !== undefined ? opciones.ventana : defaultVentanaSoc,
      ),
    registrarMensaje: jest.fn().mockResolvedValue(undefined),
  };
  const metaGraph = {
    enviarMensajeSesion: jest.fn().mockResolvedValue(undefined),
  };
  let ultimoAviso:
    | { motivo?: string; canal?: string; identificadorExterno?: string }
    | undefined;
  const avisoEquipo = {
    notificar: jest.fn((datos: { motivo?: string; canal?: string }) => {
      ultimoAviso = datos;
    }),
    notificarVentanaCerrada: jest.fn(
      (datos: {
        canal: string;
        identificadorExterno: string;
        telefono: string | null;
        conversacionId?: string;
        pedidoId?: string;
        estadoPedido?: string;
      }) => {
        ultimoAviso = {
          canal: datos.canal,
          identificadorExterno: datos.identificadorExterno,
          motivo: 'ventana cerrada',
        };
      },
    ),
  };

  const servicio = new AvisosPedidoService(
    pedidos as never,
    conversaciones as never,
    metaGraph as never,
    avisoEquipo as never,
  );

  return {
    servicio,
    pedidos,
    conversaciones,
    metaGraph,
    avisoEquipo,
    getUltimoAviso: () => ultimoAviso,
  };
}

describe('AvisosPedidoService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(AHORA);
  });
  afterEach(() => jest.useRealTimers());

  it('no envía nada si no hay pedido o no tiene teléfono', async () => {
    const { servicio, metaGraph } = armar({
      pedido: pedido('whatsapp', 'confirmado', null),
    });
    servicio.notificarEstado('ped-1');
    await jest.runAllTimersAsync();
    expect(metaGraph.enviarMensajeSesion).not.toHaveBeenCalled();
  });

  it('no envía nada si el canal no es de mensajería (ej. pos/web)', async () => {
    const { servicio, metaGraph } = armar({
      pedido: pedido('pos', 'confirmado'),
    });
    servicio.notificarEstado('ped-1');
    await jest.runAllTimersAsync();
    expect(metaGraph.enviarMensajeSesion).not.toHaveBeenCalled();
  });

  it('no envía nada si el estado es pendiente (ya tiene confirmación)', async () => {
    const { servicio, metaGraph } = armar({
      pedido: pedido('whatsapp', 'pendiente'),
    });
    servicio.notificarEstado('ped-1');
    await jest.runAllTimersAsync();
    expect(metaGraph.enviarMensajeSesion).not.toHaveBeenCalled();
  });

  describe('WhatsApp', () => {
    it('dentro de la ventana de 24h envía mensaje y registra', async () => {
      const { servicio, metaGraph, conversaciones } = armar();
      servicio.notificarEstado('ped-1');
      await jest.runAllTimersAsync();
      expect(metaGraph.enviarMensajeSesion).toHaveBeenCalledWith(
        'whatsapp',
        '573187592616',
        expect.stringContaining('Confirmamos tu pedido'),
      );
      expect(conversaciones.registrarMensaje).toHaveBeenCalledWith(
        'conv-wa-1',
        'saliente_bot',
        expect.any(String),
      );
    });

    it('fuera de la ventana de 24h no envía nada a Meta', async () => {
      const { servicio, metaGraph } = armar({
        ventana: {
          conversacionId: 'conv-wa-old',
          estado: 'bot',
          ultimaInteraccion: new Date(AHORA.getTime() - 25 * HORA_MS),
        },
      });
      servicio.notificarEstado('ped-1');
      await jest.runAllTimersAsync();
      expect(metaGraph.enviarMensajeSesion).not.toHaveBeenCalled();
    });
  });

  describe('Canales Sociales (Messenger e Instagram)', () => {
    it('dentro de la ventana envía mensaje por el canal correspondiente', async () => {
      const { servicio, metaGraph, conversaciones } = armar({
        pedido: pedido('messenger', 'en_preparacion'),
      });
      servicio.notificarEstado('ped-2');
      await jest.runAllTimersAsync();
      expect(metaGraph.enviarMensajeSesion).toHaveBeenCalledWith(
        'messenger',
        'psid-user-1',
        expect.stringContaining('ya está en el horno'),
      );
      expect(conversaciones.registrarMensaje).toHaveBeenCalledWith(
        'conv-soc-1',
        'saliente_bot',
        expect.any(String),
      );
    });

    it('fuera de ventana en Messenger/Instagram avisa al equipo y no llama a Meta', async () => {
      const { servicio, metaGraph, avisoEquipo, getUltimoAviso } = armar({
        pedido: pedido('instagram', 'en_camino'),
        ventana: {
          conversacionId: 'conv-ig-old',
          identificadorExterno: 'igsid-99',
          estado: 'bot',
          ultimaInteraccion: new Date(AHORA.getTime() - 25 * HORA_MS),
        },
      });
      servicio.notificarEstado('ped-3');
      await jest.runAllTimersAsync();
      expect(metaGraph.enviarMensajeSesion).not.toHaveBeenCalled();
      expect(avisoEquipo.notificarVentanaCerrada).toHaveBeenCalledTimes(1);
      expect(getUltimoAviso()?.canal).toBe('instagram');
      expect(getUltimoAviso()?.motivo).toContain('ventana cerrada');
    });

    it('si no existe ventana de conversación para el teléfono avisa al equipo sin llamar a Meta', async () => {
      const { servicio, metaGraph, avisoEquipo, getUltimoAviso } = armar({
        pedido: pedido('messenger', 'confirmado'),
        ventana: null,
      });
      servicio.notificarEstado('ped-4');
      await jest.runAllTimersAsync();
      expect(metaGraph.enviarMensajeSesion).not.toHaveBeenCalled();
      expect(avisoEquipo.notificarVentanaCerrada).toHaveBeenCalledTimes(1);
      expect(getUltimoAviso()?.canal).toBe('messenger');
      expect(getUltimoAviso()?.motivo).toContain('ventana cerrada');
    });
  });
});
