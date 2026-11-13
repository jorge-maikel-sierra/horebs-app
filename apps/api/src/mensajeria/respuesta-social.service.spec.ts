import type { CheckoutEnviosService } from './checkout-envios.service';
import type { ConversacionCompleta } from './conversaciones.tipos';
import type { DerivacionBotService } from './derivacion-bot.service';
import type { BotonRespuesta } from './mensajes-interactivos';
import type { EventoEntrante } from './parseo-webhook';
import type { PedidoSocialService } from './pedido-social.service';
import { RespuestaSocialService } from './respuesta-social.service';
import type { VitrinaSocialService } from './vitrina-social.service';

const CONVERSACION = { id: 'cv-1', estado: 'bot' } as ConversacionCompleta;

function evento(extra: Partial<EventoEntrante> = {}): EventoEntrante {
  return {
    canal: 'messenger',
    identificadorExterno: 'psid-1',
    telefono: null,
    texto: 'hola',
    procedenciaAnuncio: null,
    mensajeId: 'mid.1',
    ...extra,
  };
}

interface Opciones {
  inicioProducto?: boolean;
  categoria?: boolean;
  atiendePedido?: boolean;
}

function crearServicio(opciones: Opciones = {}) {
  const textos: string[] = [];
  const conOpciones: { texto: string; opciones: BotonRespuesta[] }[] = [];
  const registrados: string[] = [];
  const llamadas: string[] = [];
  const envios = {
    texto: (_c: unknown, t: string) => {
      textos.push(t);
      return Promise.resolve();
    },
    textoConOpciones: (_c: unknown, texto: string, o: BotonRespuesta[]) => {
      conOpciones.push({ texto, opciones: o });
      return Promise.resolve();
    },
    registrar: (_c: unknown, t: string) => {
      registrados.push(t);
      return Promise.resolve();
    },
  };
  const pedido = {
    iniciarProducto: (_c: unknown, nombre: string) => {
      llamadas.push(`producto:${nombre}`);
      return Promise.resolve(opciones.inicioProducto ?? false);
    },
    atenderBoton: (_c: unknown, id: string) => {
      llamadas.push(`boton:${id}`);
      return Promise.resolve(opciones.atiendePedido ?? false);
    },
  };
  const vitrina = {
    precios: () => {
      llamadas.push('precios');
      return Promise.resolve();
    },
    enviarMenu: (_c: unknown, paraPedir: boolean) => {
      llamadas.push(paraPedir ? 'menu:pedir' : 'menu');
      return Promise.resolve();
    },
    mostrarCategoria: (_c: unknown, categoriaId: string) => {
      llamadas.push(`categoria:${categoriaId}`);
      return Promise.resolve(opciones.categoria ?? true);
    },
  };
  const derivacion = {
    derivar: (ctx: { identificadorExterno: string }) => {
      llamadas.push(`derivar:${ctx.identificadorExterno}`);
      return Promise.resolve('derivada');
    },
  };
  const servicio = new RespuestaSocialService(
    envios as unknown as CheckoutEnviosService,
    pedido as unknown as PedidoSocialService,
    vitrina as unknown as VitrinaSocialService,
    derivacion as unknown as DerivacionBotService,
  );
  return { servicio, textos, conOpciones, registrados, llamadas };
}

describe('RespuestaSocialService: respuestas fijas', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Miércoles 3:00 p.m. en Bogotá.
    jest.setSystemTime(new Date('2026-11-04T15:00:00-05:00'));
  });
  afterEach(() => jest.useRealTimers());

  it('un saludo presenta al asistente y ofrece el menú de inicio, sin pasar por Gemini', async () => {
    const { servicio, conOpciones } = crearServicio();

    await expect(servicio.atender(evento(), CONVERSACION)).resolves.toBe(true);

    expect(conOpciones[0].texto).toContain(
      'asistente virtual de Pizzería Horebs',
    );
    expect(conOpciones[0].texto).toContain('"humano"');
    expect(conOpciones[0].opciones.map((o) => o.id)).toEqual([
      'mnu:menu',
      'mnu:pedir',
      'mnu:horario',
      'ped:repetir',
      'mnu:descuento',
      'mnu:humano',
    ]);
  });

  it('el descuento del 20% se contesta según el día y la hora', async () => {
    const { servicio, conOpciones } = crearServicio();

    await servicio.atender(
      evento({ texto: '¿Cómo aplico el 20% de descuento?' }),
      CONVERSACION,
    );

    expect(conOpciones[0].texto).toContain(
      'Hoy miércoles tienes 20% de descuento',
    );
    expect(conOpciones[0].texto).toContain('hasta las 8:00 p.m.');
  });

  it('el mismo descuento fuera del horario explica la regla', async () => {
    jest.setSystemTime(new Date('2026-11-07T12:00:00-05:00'));
    const { servicio, conOpciones } = crearServicio();

    await servicio.atender(evento({ texto: 'hay descuento?' }), CONVERSACION);

    expect(conOpciones[0].texto).toContain(
      'solo los miércoles y jueves, hasta las 8:00 p.m.',
    );
    expect(conOpciones[0].texto).toContain('Hoy sábado no está activo');
  });

  it('horario, ubicación, domicilio y pagos salen de los datos del negocio', async () => {
    const { servicio, conOpciones } = crearServicio();

    for (const texto of [
      'cual es el horario',
      'dónde están ubicados',
      'cuanto cuesta el domicilio',
      'como pago',
    ]) {
      await servicio.atender(evento({ texto }), CONVERSACION);
    }

    expect(conOpciones[0].texto).toContain('4:00pm – 11:00pm');
    expect(conOpciones[1].texto).toContain('Carrera 7 # 17B - 66');
    expect(conOpciones[2].texto).toContain('$5.000');
    expect(conOpciones[3].texto).toContain(
      'efectivo, transferencia bancaria y tarjeta',
    );
  });

  it('el botón del menú de inicio responde igual que el texto', async () => {
    const { servicio, conOpciones } = crearServicio();

    await servicio.atender(
      evento({ entrada: { tipo: 'boton', id: 'mnu:descuento' } }),
      CONVERSACION,
    );

    expect(conOpciones[0].texto).toContain('20% de descuento');
  });

  it('lo que no reconoce lo deja pasar para que responda Gemini', async () => {
    const { servicio, conOpciones, textos } = crearServicio();

    await expect(
      servicio.atender(
        evento({ texto: '¿Qué trae la Horebs Especial?' }),
        CONVERSACION,
      ),
    ).resolves.toBe(false);
    expect(conOpciones).toEqual([]);
    expect(textos).toEqual([]);
  });
});

describe('RespuestaSocialService: menú, pedido y persona', () => {
  it('"el menú" manda el menú de la vitrina', async () => {
    const { servicio, llamadas, conOpciones } = crearServicio();

    await servicio.atender(
      evento({ texto: 'Me regalas el menú' }),
      CONVERSACION,
    );

    expect(llamadas).toEqual(['menu']);
    expect(conOpciones).toEqual([]);
  });

  it('"hacer un pedido" manda el menú para pedir', async () => {
    const { servicio, llamadas } = crearServicio();

    await servicio.atender(
      evento({ texto: 'Hacer un pedido 🛵' }),
      CONVERSACION,
    );

    expect(llamadas).toEqual(['menu:pedir']);
  });

  it('si piden el WhatsApp manda el enlace que abre el chat', async () => {
    const { servicio, conOpciones } = crearServicio();

    await servicio.atender(
      evento({ texto: 'Cuál es el número de WhatsApp' }),
      CONVERSACION,
    );

    expect(conOpciones[0].texto).toContain('https://wa.me/573157861208');
  });

  it('"agregar al pedido" de una tarjeta inicia el pedido por botones', async () => {
    const { servicio, llamadas } = crearServicio({ inicioProducto: true });

    await expect(
      servicio.atender(
        evento({ texto: 'Quiero pedir Pizza Hawaiana' }),
        CONVERSACION,
      ),
    ).resolves.toBe(true);
    expect(llamadas).toEqual(['producto:Pizza Hawaiana']);
  });

  it('si el producto no existe sigue su camino (Gemini)', async () => {
    const { servicio } = crearServicio({ inicioProducto: false });

    await expect(
      servicio.atender(
        evento({ texto: 'Quiero pedir una lasaña' }),
        CONVERSACION,
      ),
    ).resolves.toBe(false);
  });

  it('la pregunta por precios la contesta la vitrina', async () => {
    const { servicio, llamadas } = crearServicio();

    await servicio.atender(
      evento({ texto: 'Que precio tiene las pizzas' }),
      CONVERSACION,
    );

    expect(llamadas).toEqual(['precios']);
  });

  it('"humano" deriva, avisa al equipo y confirma sin hablar de pedidos', async () => {
    const { servicio, textos, llamadas } = crearServicio();

    await servicio.atender(
      evento({ texto: 'Mi vida necesito hablar con una persona' }),
      CONVERSACION,
    );

    expect(llamadas).toEqual(['derivar:psid-1']);
    expect(textos[0]).toContain('una persona te escribe por aquí mismo');
    expect(textos[0]).not.toContain('pedido');
  });

  it('una categoría muestra sus productos; si no tiene, no se atiende', async () => {
    const ok = crearServicio();
    await expect(
      ok.servicio.atender(
        evento({ entrada: { tipo: 'boton', id: 'cat:cat-1' } }),
        CONVERSACION,
      ),
    ).resolves.toBe(true);
    expect(ok.llamadas).toEqual(['categoria:cat-1']);

    const vacia = crearServicio({ categoria: false });
    await expect(
      vacia.servicio.atender(
        evento({ entrada: { tipo: 'boton', id: 'cat:cat-9' } }),
        CONVERSACION,
      ),
    ).resolves.toBe(false);
  });

  it('"Agregar otro" vuelve a mostrar el menú', async () => {
    const { servicio, llamadas } = crearServicio();

    await servicio.atender(
      evento({ entrada: { tipo: 'boton', id: 'ped:mas' } }),
      CONVERSACION,
    );

    expect(llamadas).toEqual(['menu']);
  });

  it('los botones del pedido (tamaño, cantidad, seguir) se delegan al pedido social', async () => {
    const { servicio, llamadas } = crearServicio({ atiendePedido: true });

    await expect(
      servicio.atender(
        evento({ entrada: { tipo: 'boton', id: 'ped:q:v-1:2' } }),
        CONVERSACION,
      ),
    ).resolves.toBe(true);
    expect(llamadas).toEqual(['boton:ped:q:v-1:2']);
  });
});
