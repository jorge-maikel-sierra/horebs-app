import { createHmac } from 'crypto';
import type { CatalogService } from '../catalog/catalog.service';
import type { ConversacionesService } from './conversaciones.service';
import type { ConversacionCompleta } from './conversaciones.tipos';
import type { MediaEntranteService } from './media-entrante.service';
import type { EventoEntrante } from './parseo-webhook';
import type { RespuestaBotService } from './respuesta-bot.service';
import { WebhooksService } from './webhooks.service';

const CONVERSACION = { id: 'cv-1', estado: 'bot' } as ConversacionCompleta;

function evento(extra: Partial<EventoEntrante> = {}): EventoEntrante {
  return {
    canal: 'whatsapp',
    identificadorExterno: '573157861208',
    telefono: '573157861208',
    texto: 'hola',
    procedenciaAnuncio: null,
    mensajeId: 'wamid.1',
    ...extra,
  };
}

interface Opciones {
  duplicado?: boolean;
  falloDuplicado?: boolean;
  estado?: 'bot' | 'derivado';
  archivoAtendido?: boolean;
}

function crearServicio(opciones: Opciones = {}) {
  const llamadas: string[] = [];
  const registrados: string[] = [];
  const ctwa: string[] = [];
  const conversaciones = {
    yaProcesado: () => {
      llamadas.push('yaProcesado');
      if (opciones.falloDuplicado) return Promise.reject(new Error('tabla'));
      return Promise.resolve(opciones.duplicado ?? false);
    },
    registrarInteraccion: () => {
      llamadas.push('registrarInteraccion');
      return Promise.resolve({
        ...CONVERSACION,
        estado: opciones.estado ?? 'bot',
      });
    },
    guardarCtwaClid: (_c: string, _id: string, clid: string) => {
      ctwa.push(clid);
      return Promise.resolve();
    },
    registrarMensaje: (_id: string, _dir: string, texto: string) => {
      llamadas.push('registrarMensaje');
      registrados.push(texto);
      return Promise.resolve();
    },
  };
  const catalog = {
    resolverCarrito: () =>
      Promise.resolve({ disponibles: [], noDisponibles: 2 }),
  };
  const medios = {
    transcribirNota: (e: EventoEntrante) => {
      llamadas.push('transcribirNota');
      return Promise.resolve(e.texto);
    },
    atenderArchivo: () => {
      llamadas.push('atenderArchivo');
      return Promise.resolve(opciones.archivoAtendido ?? false);
    },
  };
  const respuestas: unknown[] = [];
  const respuesta = {
    responder: (_e: EventoEntrante, _c: unknown, carrito: unknown) => {
      llamadas.push('responder');
      respuestas.push(carrito);
      return Promise.resolve();
    },
  };
  const servicio = new WebhooksService(
    conversaciones as unknown as ConversacionesService,
    catalog as unknown as CatalogService,
    medios as unknown as MediaEntranteService,
    respuesta as unknown as RespuestaBotService,
  );
  return { servicio, llamadas, registrados, ctwa, respuestas };
}

describe('WebhooksService.verificarFirma', () => {
  const { servicio } = crearServicio();
  const cuerpo = Buffer.from('{"a":1}');
  const firma = (secreto: string): string =>
    `sha256=${createHmac('sha256', secreto).update(cuerpo).digest('hex')}`;

  it('acepta la firma HMAC correcta', () => {
    expect(servicio.verificarFirma('secreto', cuerpo, firma('secreto'))).toBe(
      true,
    );
  });

  it('rechaza una firma de otro secreto, sin prefijo o ausente', () => {
    expect(servicio.verificarFirma('secreto', cuerpo, firma('otro'))).toBe(
      false,
    );
    expect(servicio.verificarFirma('secreto', cuerpo, 'abc')).toBe(false);
    expect(servicio.verificarFirma('secreto', cuerpo, undefined)).toBe(false);
  });

  it('rechaza una firma de distinto largo', () => {
    expect(servicio.verificarFirma('secreto', cuerpo, 'sha256=abcd')).toBe(
      false,
    );
  });

  it('acepta firmas de payloads con caracteres no ASCII (tildes, ñ, emojis)', () => {
    const cuerpoNoAscii = Buffer.from(
      JSON.stringify({ texto: 'Pizza con jalapeño 🍕, champiñones y piña' }),
      'utf8',
    );
    const firmaNoAscii = `sha256=${createHmac('sha256', 'secreto')
      .update(cuerpoNoAscii)
      .digest('hex')}`;
    expect(
      servicio.verificarFirma('secreto', cuerpoNoAscii, firmaNoAscii),
    ).toBe(true);
  });
});

describe('WebhooksService.manejarEvento', () => {
  it('un mensaje nuevo se registra y le responde el bot', async () => {
    const { servicio, llamadas, registrados } = crearServicio();

    await servicio.manejarEvento(evento());

    expect(llamadas).toEqual([
      'yaProcesado',
      'transcribirNota',
      'registrarInteraccion',
      'registrarMensaje',
      'atenderArchivo',
      'responder',
    ]);
    expect(registrados).toEqual(['hola']);
  });

  it('un reenvío de Meta (mismo mensaje) se ignora sin tocar nada más', async () => {
    const { servicio, llamadas } = crearServicio({ duplicado: true });

    await servicio.manejarEvento(evento());

    expect(llamadas).toEqual(['yaProcesado']);
  });

  it('si no se puede verificar el duplicado, se procesa igual', async () => {
    const { servicio, llamadas } = crearServicio({ falloDuplicado: true });

    await servicio.manejarEvento(evento());

    expect(llamadas).toContain('responder');
  });

  it('un evento sin id de mensaje no consulta duplicados', async () => {
    const { servicio, llamadas } = crearServicio();

    await servicio.manejarEvento(evento({ mensajeId: null }));

    expect(llamadas).not.toContain('yaProcesado');
  });

  it('el carrito del catálogo se cruza con la base y arma el texto', async () => {
    const { servicio, registrados, respuestas } = crearServicio();

    await servicio.manejarEvento(
      evento({
        carrito: { items: [{ varianteId: 'v-1', cantidad: 1 }], nota: null },
      }),
    );

    expect(registrados[0]).toContain(
      'ninguno de esos productos está disponible',
    );
    expect(respuestas[0]).toEqual({ disponibles: [], noDisponibles: 2 });
  });

  it('si el archivo ya quedó atendido, el bot no responde', async () => {
    const { servicio, llamadas } = crearServicio({ archivoAtendido: true });

    await servicio.manejarEvento(evento());

    expect(llamadas).toContain('atenderArchivo');
    expect(llamadas).not.toContain('responder');
  });

  it('una conversación derivada guarda el mensaje pero no se auto-responde', async () => {
    const { servicio, llamadas, registrados } = crearServicio({
      estado: 'derivado',
    });

    await servicio.manejarEvento(evento());

    expect(registrados).toEqual(['hola']);
    expect(llamadas).not.toContain('responder');
  });

  it('guarda el ctwa_clid solo en WhatsApp con clic en anuncio', async () => {
    const wa = crearServicio();
    const messenger = crearServicio();
    const anuncio = { esAnuncio: true, ctwaClid: 'clid-1' };

    await wa.servicio.manejarEvento(evento({ procedenciaAnuncio: anuncio }));
    await messenger.servicio.manejarEvento(
      evento({ canal: 'messenger', procedenciaAnuncio: anuncio }),
    );

    expect(wa.ctwa).toEqual(['clid-1']);
    expect(messenger.ctwa).toEqual([]);
  });
});
