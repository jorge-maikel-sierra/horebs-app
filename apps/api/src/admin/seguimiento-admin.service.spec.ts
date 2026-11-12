import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { ConversacionesService } from '../mensajeria/conversaciones.service';
import type { ConversacionCompleta } from '../mensajeria/conversaciones.tipos';
import type { MetaGraphService } from '../mensajeria/meta-graph.service';
import { SeguimientoAdminService } from './seguimiento-admin.service';

const CONVERSACION = {
  id: 'cv-1',
  canal: 'whatsapp',
  identificador_externo: '573157861208',
  ultima_interaccion: new Date().toISOString(),
} as ConversacionCompleta;

describe('SeguimientoAdminService: ventana de 24 h', () => {
  it('pasadas 24 h desde el último mensaje del cliente no deja escribir (409)', async () => {
    const vieja = {
      ...CONVERSACION,
      canal: 'messenger',
      ultima_interaccion: new Date(Date.now() - 25 * 3_600_000).toISOString(),
    } as ConversacionCompleta;
    const { servicio, enviados } = crearServicio(vieja);

    await expect(
      servicio.enviarMensajeHumano('cv-1', 'hola', 'u-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(enviados).toEqual([]);
  });
});

function crearServicio(
  conversacion: ConversacionCompleta | null = CONVERSACION,
) {
  const llamadas: string[] = [];
  const conversaciones = {
    obtenerConfiguracionSeguimiento: () =>
      Promise.resolve({ recordatorioMinutos: 180, ofertaMinutos: 360 }),
    actualizarConfiguracionSeguimiento: (): Promise<void> => {
      llamadas.push('config');
      return Promise.resolve();
    },
    actualizarEstadoManual: (): Promise<void> => {
      llamadas.push('estado');
      return Promise.resolve();
    },
    obtenerPorId: () => Promise.resolve(conversacion),
    listarMensajes: () => Promise.resolve([]),
    registrarMensaje: (
      _id: string,
      direccion: string,
      texto: string,
      autor?: string,
    ) => Promise.resolve({ direccion, texto, autor }),
  };
  const enviados: string[] = [];
  let fallo: Error | null = null;
  const metaGraph = {
    enviarMensajeSesion: (_canal: string, _destino: string, texto: string) => {
      if (fallo) return Promise.reject(fallo);
      enviados.push(texto);
      return Promise.resolve();
    },
  };
  const servicio = new SeguimientoAdminService(
    conversaciones as unknown as ConversacionesService,
    metaGraph as unknown as MetaGraphService,
  );
  return {
    servicio,
    llamadas,
    enviados,
    fallar: (e: Error) => {
      fallo = e;
    },
  };
}

describe('SeguimientoAdminService: configuración', () => {
  it('devuelve los minutos en snake_case', async () => {
    const { servicio } = crearServicio();

    await expect(servicio.obtenerConfiguracionSeguimiento()).resolves.toEqual({
      recordatorio_minutos: 180,
      oferta_minutos: 360,
    });
  });

  it.each([
    [0, 60],
    [60, -1],
    [1.5, 60],
  ])('minutos %p y %p no son enteros positivos (400)', async (r, o) => {
    const { servicio, llamadas } = crearServicio();

    await expect(
      servicio.actualizarConfiguracionSeguimiento(r, o),
    ).rejects.toThrow(BadRequestException);
    expect(llamadas).toEqual([]);
  });

  it('guarda y devuelve los minutos nuevos', async () => {
    const { servicio, llamadas } = crearServicio();

    await expect(
      servicio.actualizarConfiguracionSeguimiento(30, 90),
    ).resolves.toEqual({ recordatorio_minutos: 30, oferta_minutos: 90 });
    expect(llamadas).toEqual(['config']);
  });
});

describe('SeguimientoAdminService: conversaciones', () => {
  it('solo acepta los estados "bot" y "derivado"', async () => {
    const { servicio, llamadas } = crearServicio();

    await expect(
      servicio.actualizarEstadoConversacion('cv-1', 'cerrado'),
    ).rejects.toThrow(BadRequestException);
    await expect(
      servicio.actualizarEstadoConversacion('cv-1', 'derivado'),
    ).resolves.toEqual({ id: 'cv-1', estado: 'derivado' });
    expect(llamadas).toEqual(['estado']);
  });

  it('los mensajes de una conversación inexistente son 404', async () => {
    const { servicio } = crearServicio(null);

    await expect(servicio.listarMensajesConversacion('x')).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('SeguimientoAdminService.enviarMensajeHumano', () => {
  it.each([[''], ['   '], ['a'.repeat(4097)]])(
    'un texto vacío o de más de 4096 caracteres es 400 y no envía',
    async (texto) => {
      const { servicio, enviados } = crearServicio();

      await expect(
        servicio.enviarMensajeHumano('cv-1', texto, 'u-1'),
      ).rejects.toThrow(BadRequestException);
      expect(enviados).toEqual([]);
    },
  );

  it('una conversación inexistente es 404', async () => {
    const { servicio } = crearServicio(null);

    await expect(
      servicio.enviarMensajeHumano('x', 'hola', 'u-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('envía por Graph API y registra el mensaje con quien lo mandó', async () => {
    const { servicio, enviados } = crearServicio();

    const mensaje = await servicio.enviarMensajeHumano('cv-1', ' hola ', 'u-1');

    expect(enviados).toEqual(['hola']);
    expect(mensaje).toMatchObject({
      direccion: 'saliente_humano',
      texto: 'hola',
      autor: 'u-1',
    });
  });

  it('si Graph API falla responde 400 con el motivo y no registra nada', async () => {
    const { servicio, fallar } = crearServicio();
    fallar(new Error('ventana de 24 h cerrada'));

    await expect(
      servicio.enviarMensajeHumano('cv-1', 'hola', 'u-1'),
    ).rejects.toThrow('ventana de 24 h cerrada');
  });
});
