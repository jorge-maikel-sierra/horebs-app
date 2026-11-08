import type { AtencionDeterministaService } from './atencion-determinista.service';
import type { ConversacionesService } from './conversaciones.service';
import type { ConversacionCompleta } from './conversaciones.tipos';
import type { GeminiService } from './gemini.service';
import type { MetaGraphService } from './meta-graph.service';
import type { EventoEntrante } from './parseo-webhook';
import { RespuestaBotService } from './respuesta-bot.service';

const CONVERSACION = { id: 'cv-1', estado: 'bot' } as ConversacionCompleta;

function evento(extra: Partial<EventoEntrante> = {}): EventoEntrante {
  return {
    canal: 'whatsapp',
    identificadorExterno: '573157861208',
    telefono: '573157861208',
    texto: 'una hawaiana',
    procedenciaAnuncio: null,
    mensajeId: 'wamid.1',
    ...extra,
  };
}

interface Opciones {
  atiendeDeterminista?: boolean;
  respuestaGemini?: string | null;
}

function crearServicio(opciones: Opciones = {}) {
  const llamadas: string[] = [];
  const enviados: string[] = [];
  const registrados: string[] = [];
  const gemini = {
    responder: () => {
      llamadas.push('gemini');
      return Promise.resolve(
        opciones.respuestaGemini === undefined
          ? 'Claro, ¿de qué tamaño?'
          : opciones.respuestaGemini,
      );
    },
  };
  const metaGraph = {
    marcarLeidoEscribiendo: () => {
      llamadas.push('leido');
    },
    enviarMensajeSesion: (_c: string, _id: string, texto: string) => {
      enviados.push(texto);
      return Promise.resolve();
    },
  };
  const conversaciones = {
    registrarMensaje: (_id: string, _dir: string, texto: string) => {
      registrados.push(texto);
      return Promise.resolve();
    },
  };
  const determinista = {
    atender: () => {
      llamadas.push('determinista');
      return Promise.resolve(opciones.atiendeDeterminista ?? false);
    },
  };
  const servicio = new RespuestaBotService(
    gemini as unknown as GeminiService,
    metaGraph as unknown as MetaGraphService,
    conversaciones as unknown as ConversacionesService,
    determinista as unknown as AtencionDeterministaService,
  );
  return { servicio, llamadas, enviados, registrados };
}

describe('RespuestaBotService.responder', () => {
  it('marca el mensaje como leído y responde con Gemini si nada determinístico aplica', async () => {
    const { servicio, llamadas, enviados, registrados } = crearServicio();

    await servicio.responder(evento(), CONVERSACION, null);

    expect(llamadas).toEqual(['leido', 'determinista', 'gemini']);
    expect(enviados).toEqual(['Claro, ¿de qué tamaño?']);
    expect(registrados).toEqual(['Claro, ¿de qué tamaño?']);
  });

  it('si lo determinístico atiende el mensaje, Gemini no responde', async () => {
    const { servicio, llamadas, enviados } = crearServicio({
      atiendeDeterminista: true,
    });

    await servicio.responder(
      evento({ canal: 'messenger', identificadorExterno: 'psid-1' }),
      CONVERSACION,
      null,
    );

    expect(llamadas).toEqual(['leido', 'determinista']);
    expect(enviados).toEqual([]);
  });

  it('si Gemini devuelve null (la herramienta ya respondió) no se envía nada', async () => {
    const { servicio, enviados, registrados } = crearServicio({
      respuestaGemini: null,
    });

    await servicio.responder(evento(), CONVERSACION, null);

    expect(enviados).toEqual([]);
    expect(registrados).toEqual([]);
  });
});
