import { RecomprasService } from './recompras.service';
import type { PedidoParaAvisoDto } from '../pedidos/pedidos.tipos';

const HORA_MS = 60 * 60 * 1000;
const AHORA = new Date('2026-10-28T20:00:00Z');

function pedidoParaRecompra(
  id = 'ped-rec-1',
  telefono: string | null = '3187592616',
): PedidoParaAvisoDto {
  return {
    id,
    canal: 'whatsapp',
    estado: 'entregado',
    modalidad: 'domicilio',
    direccionEntrega: 'Carrera 7 # 17B - 66',
    telefono,
    puntosGanados: 50,
    puntosActuales: 150,
  };
}

describe('RecomprasService', () => {
  const pedidos = {
    pedidosParaRecompra: jest.fn(),
    reclamarRecompra: jest.fn(),
  };
  const conversaciones = {
    obtenerVentana: jest.fn(),
    registrarMensaje: jest.fn(),
  };
  const metaGraph = {
    enviarBotones: jest.fn(),
  };
  const puntos = {
    obtenerConfiguracion: jest.fn().mockResolvedValue({
      valorPuntoPesos: 50,
      puntosMinimoCanje: 100,
    }),
  };

  const servicio = new RecomprasService(
    pedidos as never,
    conversaciones as never,
    metaGraph as never,
    puntos as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(AHORA);
  });
  afterEach(() => jest.useRealTimers());

  it('no envía si no hay pedidos para recompra', async () => {
    pedidos.pedidosParaRecompra.mockResolvedValue([]);
    await servicio.enviarRecompras();
    expect(metaGraph.enviarBotones).not.toHaveBeenCalled();
  });

  it('no envía si la conversación está fuera de la ventana de recompra (última hora)', async () => {
    pedidos.pedidosParaRecompra.mockResolvedValue([pedidoParaRecompra()]);
    conversaciones.obtenerVentana.mockResolvedValue({
      conversacionId: 'conv-1',
      estado: 'bot',
      ultimaInteraccion: new Date(AHORA.getTime() - 2 * HORA_MS), // hace 2 horas (no en la ventana de 23-24h)
    });
    await servicio.enviarRecompras();
    expect(metaGraph.enviarBotones).not.toHaveBeenCalled();
  });

  it('en la última hora de la ventana (hace 23.5h) envía la invitación con botones y puntos', async () => {
    const p = pedidoParaRecompra();
    pedidos.pedidosParaRecompra.mockResolvedValue([p]);
    pedidos.reclamarRecompra.mockResolvedValue(true);
    conversaciones.obtenerVentana.mockResolvedValue({
      conversacionId: 'conv-1',
      estado: 'bot',
      ultimaInteraccion: new Date(AHORA.getTime() - 23.5 * HORA_MS),
    });
    await servicio.enviarRecompras();
    expect(pedidos.reclamarRecompra).toHaveBeenCalledWith(p.id);
    expect(metaGraph.enviarBotones).toHaveBeenCalledWith(
      'whatsapp',
      '573187592616',
      expect.stringContaining('150: son *$7.500* para tu próxima compra'),
      expect.arrayContaining([
        expect.objectContaining({ titulo: '🍕 Pedir lo mismo' }),
      ]),
    );
    expect(conversaciones.registrarMensaje).toHaveBeenCalledWith(
      'conv-1',
      'saliente_bot',
      expect.stringContaining('🍕 Pedir lo mismo'),
    );
  });

  it('si ya fue reclamada por otra corrida no duplica el mensaje', async () => {
    const p = pedidoParaRecompra();
    pedidos.pedidosParaRecompra.mockResolvedValue([p]);
    pedidos.reclamarRecompra.mockResolvedValue(false);
    conversaciones.obtenerVentana.mockResolvedValue({
      conversacionId: 'conv-1',
      estado: 'bot',
      ultimaInteraccion: new Date(AHORA.getTime() - 23.5 * HORA_MS),
    });
    await servicio.enviarRecompras();
    expect(metaGraph.enviarBotones).not.toHaveBeenCalled();
  });
});
