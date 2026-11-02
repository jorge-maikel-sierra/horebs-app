import type { ComprobantesService } from './comprobantes.service';
import type { ConversacionesService } from './conversaciones.service';
import type { ConversacionCompleta } from './conversaciones.tipos';
import type { GeminiService } from './gemini.service';
import {
  MENSAJE_AUDIO_NO_ENTENDIDO,
  MENSAJE_SOLO_TEXTO,
  MediaEntranteService,
} from './media-entrante.service';
import type { MetaGraphService } from './meta-graph.service';
import type { EventoEntrante } from './parseo-webhook';

function evento(extra: Partial<EventoEntrante> = {}): EventoEntrante {
  return {
    canal: 'whatsapp',
    identificadorExterno: '573157861208',
    telefono: '573157861208',
    texto: '',
    procedenciaAnuncio: null,
    mensajeId: 'wamid.1',
    ...extra,
  };
}

const conversacion = (estado: 'bot' | 'derivado'): ConversacionCompleta =>
  ({ id: 'cv-1', estado }) as ConversacionCompleta;

interface Opciones {
  transcripcion?: string | null;
  falloDescarga?: boolean;
  comprobante?: boolean | Error;
}

function crearServicio(opciones: Opciones = {}) {
  const enviados: string[] = [];
  const registrados: string[] = [];
  const procesados: unknown[] = [];
  const gemini = {
    transcribirAudio: () => Promise.resolve(opciones.transcripcion ?? null),
  };
  const metaGraph = {
    descargarMedia: () => {
      if (opciones.falloDescarga) return Promise.reject(new Error('404'));
      return Promise.resolve({ datos: Buffer.from('a'), mime: 'audio/ogg' });
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
  const comprobantes = {
    procesar: (datos: unknown) => {
      procesados.push(datos);
      if (opciones.comprobante instanceof Error) {
        return Promise.reject(opciones.comprobante);
      }
      return Promise.resolve(opciones.comprobante ?? false);
    },
  };
  const servicio = new MediaEntranteService(
    gemini as unknown as GeminiService,
    metaGraph as unknown as MetaGraphService,
    conversaciones as unknown as ConversacionesService,
    comprobantes as unknown as ComprobantesService,
  );
  return { servicio, enviados, registrados, procesados };
}

describe('MediaEntranteService.transcribirNota', () => {
  it('una nota de voz se transcribe y sigue como texto escrito', async () => {
    const { servicio } = crearServicio({ transcripcion: 'una hawaiana' });
    const e = evento({ media: { id: 'm-1', tipo: 'audio' } });

    const historial = await servicio.transcribirNota(e);

    expect(historial).toBe('🎤 una hawaiana');
    expect(e.texto).toBe('una hawaiana');
    expect(e.media).toBeUndefined();
  });

  it('si no se puede transcribir, queda el evento como estaba', async () => {
    const sinTexto = crearServicio({ transcripcion: null });
    const sinDescarga = crearServicio({ falloDescarga: true });

    const e1 = evento({ media: { id: 'm-1', tipo: 'audio' } });
    const e2 = evento({ media: { id: 'm-2', tipo: 'audio' } });

    await expect(sinTexto.servicio.transcribirNota(e1)).resolves.toBe('');
    await expect(sinDescarga.servicio.transcribirNota(e2)).resolves.toBe('');
    expect(e1.media).toEqual({ id: 'm-1', tipo: 'audio' });
    expect(e2.media).toEqual({ id: 'm-2', tipo: 'audio' });
  });

  it('un mensaje sin audio, o de otro canal, no se toca', async () => {
    const { servicio } = crearServicio({ transcripcion: 'x' });

    await expect(
      servicio.transcribirNota(evento({ texto: 'hola' })),
    ).resolves.toBe('hola');
    await expect(
      servicio.transcribirNota(
        evento({
          canal: 'messenger',
          texto: 'hola',
          media: { id: 'm', tipo: 'audio' },
        }),
      ),
    ).resolves.toBe('hola');
  });
});

describe('MediaEntranteService.atenderArchivo', () => {
  it('un evento sin archivo, sin id o de otro canal no es de este servicio', async () => {
    const { servicio } = crearServicio();

    await expect(
      servicio.atenderArchivo(evento(), conversacion('bot')),
    ).resolves.toBe(false);
    await expect(
      servicio.atenderArchivo(
        evento({ mensajeId: null, media: { id: 'f', tipo: 'imagen' } }),
        conversacion('bot'),
      ),
    ).resolves.toBe(false);
    await expect(
      servicio.atenderArchivo(
        evento({ canal: 'messenger', media: { id: 'f', tipo: 'imagen' } }),
        conversacion('bot'),
      ),
    ).resolves.toBe(false);
  });

  it('una foto que es el comprobante esperado se guarda y no se responde', async () => {
    const { servicio, enviados, procesados } = crearServicio({
      comprobante: true,
    });

    const atendido = await servicio.atenderArchivo(
      evento({ media: { id: 'f-1', tipo: 'imagen' } }),
      conversacion('bot'),
    );

    expect(atendido).toBe(true);
    expect(procesados).toEqual([
      {
        identificadorExterno: '573157861208',
        conversacionId: 'cv-1',
        mensajeId: 'wamid.1',
        mediaId: 'f-1',
      },
    ]);
    expect(enviados).toEqual([]);
  });

  it('una foto que no era comprobante recibe la respuesta fija', async () => {
    const { servicio, enviados, registrados } = crearServicio({
      comprobante: false,
    });

    const atendido = await servicio.atenderArchivo(
      evento({ media: { id: 'f-1', tipo: 'imagen' } }),
      conversacion('bot'),
    );

    expect(atendido).toBe(true);
    expect(enviados).toEqual([MENSAJE_SOLO_TEXTO]);
    expect(registrados).toEqual([MENSAJE_SOLO_TEXTO]);
  });

  it('si falla guardar el comprobante, responde como si no lo fuera', async () => {
    const { servicio, enviados } = crearServicio({
      comprobante: new Error('storage'),
    });

    await servicio.atenderArchivo(
      evento({ media: { id: 'f-1', tipo: 'imagen' } }),
      conversacion('bot'),
    );

    expect(enviados).toEqual([MENSAJE_SOLO_TEXTO]);
  });

  it('un audio que no se pudo transcribir recibe su respuesta fija', async () => {
    const { servicio, enviados, procesados } = crearServicio();

    await servicio.atenderArchivo(
      evento({ media: { id: 'a-1', tipo: 'audio' } }),
      conversacion('bot'),
    );

    expect(procesados).toEqual([]);
    expect(enviados).toEqual([MENSAJE_AUDIO_NO_ENTENDIDO]);
  });

  it('con la conversación derivada no se responde, pero el comprobante igual se intenta guardar', async () => {
    const { servicio, enviados, procesados } = crearServicio({
      comprobante: false,
    });

    const atendido = await servicio.atenderArchivo(
      evento({ media: { id: 'f-1', tipo: 'imagen' } }),
      conversacion('derivado'),
    );

    expect(atendido).toBe(true);
    expect(procesados).toHaveLength(1);
    expect(enviados).toEqual([]);
  });
});
