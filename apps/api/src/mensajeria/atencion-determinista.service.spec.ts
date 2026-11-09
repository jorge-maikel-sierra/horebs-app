import type { AtencionDeterministaService as Tipo } from './atencion-determinista.service';
import { AtencionDeterministaService } from './atencion-determinista.service';
import type { CheckoutWhatsappService } from './checkout-whatsapp.service';
import type { ConversacionesService } from './conversaciones.service';
import type { ConversacionCompleta } from './conversaciones.tipos';
import type { EventoEntrante } from './parseo-webhook';
import type { RespuestaSocialService } from './respuesta-social.service';

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
  atiendeSocial?: boolean;
}

function crearServicio(opciones: Opciones = {}): {
  servicio: Tipo;
  llamadas: string[];
  entradas: unknown[];
} {
  const llamadas: string[] = [];
  const entradas: unknown[] = [];
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
  const conversaciones = {
    obtenerUltimaInteraccionGemini: () =>
      Promise.resolve(opciones.hiloGemini ?? null),
  };
  const social = {
    atender: () => {
      llamadas.push('social');
      return Promise.resolve(opciones.atiendeSocial ?? false);
    },
  };
  const servicio = new AtencionDeterministaService(
    checkout as unknown as CheckoutWhatsappService,
    conversaciones as unknown as ConversacionesService,
    social as unknown as RespuestaSocialService,
  );
  return { servicio, llamadas, entradas };
}

describe('AtencionDeterministaService.atender', () => {
  it('en WhatsApp, si el checkout no aplica, devuelve false para que responda Gemini', async () => {
    const { servicio, llamadas } = crearServicio();

    await expect(servicio.atender(evento(), CONVERSACION, null)).resolves.toBe(
      false,
    );
    expect(llamadas).toEqual(['manejar']);
  });

  it('un carrito del catálogo inicia el checkout', async () => {
    const { servicio, llamadas } = crearServicio();

    await expect(
      servicio.atender(
        evento({ carrito: { items: [], nota: 'sin cebolla' } }),
        CONVERSACION,
        { disponibles: [], noDisponibles: 0 },
      ),
    ).resolves.toBe(true);
    expect(llamadas).toEqual(['iniciar']);
  });

  it('si el checkout maneja la entrada, devuelve true y no sigue', async () => {
    const { servicio, llamadas } = crearServicio({ manejaCheckout: true });

    await expect(
      servicio.atender(
        evento({ canal: 'messenger', identificadorExterno: 'psid-1' }),
        CONVERSACION,
        null,
      ),
    ).resolves.toBe(true);
    expect(llamadas).toEqual(['manejar']);
  });

  it('un toque de botón llega al checkout como entrada, no como texto', async () => {
    const { servicio, entradas } = crearServicio({ manejaCheckout: true });

    await servicio.atender(
      evento({ entrada: { tipo: 'boton', id: 'ck:domicilio' } }),
      CONVERSACION,
      null,
    );

    expect(entradas[0]).toMatchObject({ tipo: 'boton', id: 'ck:domicilio' });
  });

  it('un saludo en WhatsApp de quien nunca habló con Gemini y ya pidió antes ofrece "lo mismo"', async () => {
    const { servicio, llamadas } = crearServicio({ ofreceLoMismo: true });

    await expect(
      servicio.atender(evento({ texto: 'hola' }), CONVERSACION, null),
    ).resolves.toBe(true);
    expect(llamadas).toEqual(['manejar', 'ofrecerLoMismo']);
  });

  it('si ya hay un hilo con Gemini, un saludo no ofrece "lo mismo"', async () => {
    const { servicio, llamadas } = crearServicio({
      ofreceLoMismo: true,
      hiloGemini: 'hilo-1',
    });

    await servicio.atender(evento({ texto: 'hola' }), CONVERSACION, null);

    expect(llamadas).toEqual(['manejar']);
  });

  it('en Messenger e Instagram, si el checkout no aplica, atiende el flujo social', async () => {
    for (const canal of ['messenger', 'instagram'] as const) {
      const { servicio, llamadas } = crearServicio({ atiendeSocial: true });

      await expect(
        servicio.atender(
          evento({ canal, identificadorExterno: 'id-1', texto: 'hola' }),
          CONVERSACION,
          null,
        ),
      ).resolves.toBe(true);
      // "Lo mismo" es solo de WhatsApp: en redes no se consulta el historial.
      expect(llamadas).toEqual(['manejar', 'social']);
    }
  });

  it('en Messenger, si tampoco lo atiende el flujo social, responde Gemini', async () => {
    const { servicio } = crearServicio();

    await expect(
      servicio.atender(
        evento({ canal: 'messenger', identificadorExterno: 'psid-1' }),
        CONVERSACION,
        null,
      ),
    ).resolves.toBe(false);
  });

  it('en WhatsApp nunca se consulta el flujo social', async () => {
    const { servicio, llamadas } = crearServicio({ atiendeSocial: true });

    await servicio.atender(evento(), CONVERSACION, null);

    expect(llamadas).not.toContain('social');
  });
});
