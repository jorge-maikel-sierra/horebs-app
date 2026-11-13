import type { AtencionDeterministaService } from './atencion-determinista.service';
import type { ConversacionesService } from './conversaciones.service';
import type { ConversacionCompleta } from './conversaciones.tipos';
import type { GeminiService } from './gemini.service';
import type { MetaGraphService } from './meta-graph.service';
import type { EventoEntrante } from './parseo-webhook';
import {
  RespuestaBotService,
  TEXTO_RETOMAR_PEDIDO,
} from './respuesta-bot.service';

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
  carrito?: { varianteId: string; cantidad: number }[];
  checkout?: { paso: string } | null;
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
    enviarBotones: (
      _c: string,
      _id: string,
      cuerpo: string,
      botones: { id: string }[],
    ) => {
      enviados.push(`${cuerpo} [${botones.map((b) => b.id).join(',')}]`);
      return Promise.resolve();
    },
  };
  const conversaciones = {
    registrarMensaje: (_id: string, _dir: string, texto: string) => {
      registrados.push(texto);
      return Promise.resolve();
    },
    obtenerCarrito: () => Promise.resolve(opciones.carrito ?? []),
    obtenerCheckout: () => Promise.resolve(opciones.checkout ?? null),
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

  it('en Messenger, si quedó un carrito a medias, ofrece seguir con el pedido tras la respuesta de Gemini', async () => {
    const { servicio, enviados, registrados } = crearServicio({
      respuestaGemini: 'La personal trae 6 porciones.',
      carrito: [{ varianteId: 'v-1', cantidad: 1 }],
    });

    await servicio.responder(
      evento({ canal: 'messenger', identificadorExterno: 'psid-1' }),
      CONVERSACION,
      null,
    );

    expect(enviados).toEqual([
      'La personal trae 6 porciones.',
      `${TEXTO_RETOMAR_PEDIDO} [ped:mas,ped:fin,ped:vaciar]`,
    ]);
    expect(registrados).toContain(TEXTO_RETOMAR_PEDIDO);
  });

  it('no ofrece seguir si no hay carrito, si ya está en el checkout o si es WhatsApp', async () => {
    const sinCarrito = crearServicio();
    await sinCarrito.servicio.responder(
      evento({ canal: 'messenger', identificadorExterno: 'psid-1' }),
      CONVERSACION,
      null,
    );
    expect(sinCarrito.enviados).toHaveLength(1);

    const enCheckout = crearServicio({
      carrito: [{ varianteId: 'v-1', cantidad: 1 }],
      checkout: { paso: 'modalidad' },
    });
    await enCheckout.servicio.responder(
      evento({ canal: 'instagram', identificadorExterno: 'igsid-1' }),
      CONVERSACION,
      null,
    );
    expect(enCheckout.enviados).toHaveLength(1);

    const whatsapp = crearServicio({
      carrito: [{ varianteId: 'v-1', cantidad: 1 }],
    });
    await whatsapp.servicio.responder(evento(), CONVERSACION, null);
    expect(whatsapp.enviados).toHaveLength(1);
  });
});
