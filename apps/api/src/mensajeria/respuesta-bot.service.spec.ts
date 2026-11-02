import type { CheckoutWhatsappService } from './checkout-whatsapp.service';
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
  manejaCheckout?: boolean;
  ofreceLoMismo?: boolean;
  hiloGemini?: string | null;
  respuestaGemini?: string | null;
}

function crearServicio(opciones: Opciones = {}) {
  const llamadas: string[] = [];
  const enviados: string[] = [];
  const registrados: string[] = [];
  const entradas: unknown[] = [];
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
    obtenerUltimaInteraccionGemini: () =>
      Promise.resolve(opciones.hiloGemini ?? null),
  };
  const checkout = {
    iniciar: () => {
      llamadas.push('iniciar');
      return Promise.resolve();
    },
    manejar: (_ctx: unknown, entrada: unknown) => {
      llamadas.push('manejar');
      entradas.push(entrada);
      return Promise.resolve(opciones.manejaCheckout ?? false);
    },
    ofrecerLoMismo: () => {
      llamadas.push('ofrecerLoMismo');
      return Promise.resolve(opciones.ofreceLoMismo ?? false);
    },
  };
  const servicio = new RespuestaBotService(
    gemini as unknown as GeminiService,
    metaGraph as unknown as MetaGraphService,
    conversaciones as unknown as ConversacionesService,
    checkout as unknown as CheckoutWhatsappService,
  );
  return { servicio, llamadas, enviados, registrados, entradas };
}

describe('RespuestaBotService.responder', () => {
  it('marca el mensaje como leído y responde con Gemini si el checkout no aplica', async () => {
    const { servicio, llamadas, enviados, registrados } = crearServicio();

    await servicio.responder(evento(), CONVERSACION, null);

    expect(llamadas).toEqual(['leido', 'manejar', 'gemini']);
    expect(enviados).toEqual(['Claro, ¿de qué tamaño?']);
    expect(registrados).toEqual(['Claro, ¿de qué tamaño?']);
  });

  it('un carrito del catálogo inicia el checkout sin pasar por Gemini', async () => {
    const { servicio, llamadas, enviados } = crearServicio();

    await servicio.responder(
      evento({ carrito: { items: [], nota: 'sin cebolla' } }),
      CONVERSACION,
      { disponibles: [], noDisponibles: 0 },
    );

    expect(llamadas).toEqual(['leido', 'iniciar']);
    expect(enviados).toEqual([]);
  });

  it('si el checkout maneja la entrada, Gemini no responde', async () => {
    const { servicio, llamadas } = crearServicio({ manejaCheckout: true });

    await servicio.responder(evento(), CONVERSACION, null);

    expect(llamadas).toEqual(['leido', 'manejar']);
  });

  it('un toque de botón llega al checkout como entrada, no como texto', async () => {
    const { servicio, entradas } = crearServicio({ manejaCheckout: true });

    await servicio.responder(
      evento({
        entrada: { tipo: 'boton', id: 'ck:domicilio' },
      }),
      CONVERSACION,
      null,
    );

    expect(entradas[0]).toMatchObject({ tipo: 'boton', id: 'ck:domicilio' });
  });

  it('un saludo de quien nunca habló con Gemini y ya pidió antes ofrece "lo mismo"', async () => {
    const { servicio, llamadas } = crearServicio({ ofreceLoMismo: true });

    await servicio.responder(evento({ texto: 'hola' }), CONVERSACION, null);

    expect(llamadas).toEqual(['leido', 'manejar', 'ofrecerLoMismo']);
  });

  it('si ya hay un hilo con Gemini, un saludo no ofrece "lo mismo"', async () => {
    const { servicio, llamadas } = crearServicio({
      ofreceLoMismo: true,
      hiloGemini: 'hilo-1',
    });

    await servicio.responder(evento({ texto: 'hola' }), CONVERSACION, null);

    expect(llamadas).toEqual(['leido', 'manejar', 'gemini']);
  });

  it('en Messenger no hay checkout por botones ni "leído"', async () => {
    const { servicio, llamadas } = crearServicio();

    await servicio.responder(
      evento({ canal: 'messenger', mensajeId: 'mid.1' }),
      CONVERSACION,
      null,
    );

    expect(llamadas).toEqual(['gemini']);
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
