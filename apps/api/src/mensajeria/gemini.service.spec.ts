import { MENSAJE_DERIVACION } from './aviso-equipo.service';
import type { ConversacionesService } from './conversaciones.service';
import type { DespachoHerramientasService } from './despacho-herramientas.service';
import type { EnvioHerramientasService } from './envio-herramientas.service';
import type {
  GeminiClienteService,
  RespuestaInteraction,
} from './gemini-cliente.service';
import { GeminiService } from './gemini.service';
import type { ContextoHerramienta } from './herramientas-bot.tipos';

const CTX: ContextoHerramienta = {
  canal: 'whatsapp',
  identificadorExterno: '573157861208',
  telefono: '573157861208',
  conversacionId: 'cv-1',
};

const texto = (id: string, t: string): RespuestaInteraction =>
  ({
    id,
    status: 'completed',
    steps: [{ type: 'model_output', content: [{ type: 'text', text: t }] }],
  }) as unknown as RespuestaInteraction;

const conHerramienta = (id: string, name: string): RespuestaInteraction =>
  ({
    id,
    status: 'requires_action',
    steps: [{ type: 'function_call', id: 'call-1', name, arguments: {} }],
  }) as unknown as RespuestaInteraction;

interface Opciones {
  configurado?: boolean;
  dentroDelLimite?: boolean;
  respuestas?: (RespuestaInteraction | Error)[];
  mandoElMensaje?: boolean;
  resultado?: string | null;
}

function crearServicio(opciones: Opciones = {}) {
  const respuestas = [...(opciones.respuestas ?? [texto('r-1', 'Hola')])];
  const guardadas: string[] = [];
  const derivaciones: number[] = [];
  const llamadas: Array<{ model: string; system_instruction?: string }> = [];
  const cliente = {
    configurado: opciones.configurado ?? true,
    modelo: 'modelo-1',
    llamar: (params: { model: string; system_instruction?: string }) => {
      llamadas.push(params);
      const siguiente = respuestas.shift();
      if (siguiente instanceof Error) return Promise.reject(siguiente);
      return Promise.resolve(siguiente);
    },
  };
  const conversaciones = {
    dentroDelLimiteDeMensajes: () =>
      Promise.resolve(opciones.dentroDelLimite ?? true),
    obtenerUltimaInteraccionGemini: () => Promise.resolve(null),
    guardarInteraccionGemini: (
      _c: string,
      _id: string,
      interaccion: string,
    ) => {
      guardadas.push(interaccion);
      return Promise.resolve();
    },
  };
  const envios = {
    mandoElMensaje: () => Promise.resolve(opciones.mandoElMensaje ?? false),
  };
  const despacho = {
    resultado: () =>
      Promise.resolve(
        opciones.resultado === undefined ? 'listo' : opciones.resultado,
      ),
    derivar: () => {
      derivaciones.push(1);
      return Promise.resolve('derivado');
    },
  };
  const servicio = new GeminiService(
    cliente as unknown as GeminiClienteService,
    conversaciones as unknown as ConversacionesService,
    envios as unknown as EnvioHerramientasService,
    despacho as unknown as DespachoHerramientasService,
  );
  return { servicio, guardadas, derivaciones, llamadas };
}

describe('GeminiService.responder', () => {
  it('sin configurar avisa que no puede responder y ofrece una persona', async () => {
    const { servicio } = crearServicio({ configurado: false });

    await expect(servicio.responder(CTX, 'hola')).resolves.toContain(
      'escribí *humano*',
    );
  });

  it('pasado el límite de mensajes pide esperar y no llama al modelo', async () => {
    const { servicio, guardadas } = crearServicio({ dentroDelLimite: false });

    await expect(servicio.responder(CTX, 'hola')).resolves.toContain(
      'muchos mensajes seguidos',
    );
    expect(guardadas).toEqual([]);
  });

  it('responde con el texto del modelo y guarda la interacción', async () => {
    const { servicio, guardadas } = crearServicio({
      respuestas: [texto('r-1', 'Claro, ¿de qué tamaño?')],
    });

    await expect(servicio.responder(CTX, 'una pizza')).resolves.toBe(
      'Claro, ¿de qué tamaño?',
    );
    expect(guardadas).toEqual(['r-1']);
  });

  it('corrige el Markdown del modelo al formato de WhatsApp', async () => {
    const { servicio } = crearServicio({
      respuestas: [texto('r-1', '**Hawaiana**\n* jamón y piña')],
    });

    await expect(servicio.responder(CTX, 'menú')).resolves.toBe(
      '*Hawaiana*\n- jamón y piña',
    );
  });

  it('ejecuta la herramienta y le devuelve el resultado al modelo', async () => {
    const { servicio, guardadas } = crearServicio({
      respuestas: [
        conHerramienta('r-1', 'obtener_horario'),
        texto('r-2', 'Abrimos a las 4'),
      ],
    });

    await expect(servicio.responder(CTX, 'horario')).resolves.toBe(
      'Abrimos a las 4',
    );
    expect(guardadas).toEqual(['r-2']);
  });

  it('si la herramienta ya mandó el mensaje, no hay respuesta que enviar', async () => {
    const { servicio } = crearServicio({
      respuestas: [conHerramienta('r-1', 'enviar_catalogo')],
      mandoElMensaje: true,
    });

    await expect(servicio.responder(CTX, 'menú')).resolves.toBeNull();
  });

  it('si calcular_pedido ya mandó el resumen, tampoco hay nada que enviar', async () => {
    const { servicio } = crearServicio({
      respuestas: [conHerramienta('r-1', 'calcular_pedido')],
      resultado: null,
    });

    await expect(servicio.responder(CTX, 'listo')).resolves.toBeNull();
  });

  it('al derivar a una persona no pisa la interacción de Gemini', async () => {
    const { servicio, guardadas } = crearServicio({
      respuestas: [
        conHerramienta('r-1', 'derivar_a_humano'),
        texto('r-2', 'Te paso con alguien'),
      ],
    });

    await servicio.responder(CTX, 'quiero hablar con alguien');

    expect(guardadas).toEqual([]);
  });

  it('un número largo que ninguna herramienta devolvió se bloquea y se deriva', async () => {
    const { servicio, derivaciones } = crearServicio({
      respuestas: [texto('r-1', 'Transferí a la cuenta 12345678901234')],
    });

    await expect(servicio.responder(CTX, 'cómo pago')).resolves.toBe(
      MENSAJE_DERIVACION,
    );
    expect(derivaciones).toHaveLength(1);
  });

  it('un error del modelo se responde con una disculpa y la opción humana', async () => {
    const { servicio } = crearServicio({ respuestas: [new Error('503')] });

    await expect(servicio.responder(CTX, 'hola')).resolves.toContain(
      'Perdón, tuve un problema',
    );
  });

  it('recorta lo que pasa del largo máximo de WhatsApp', async () => {
    const { servicio } = crearServicio({
      respuestas: [texto('r-1', 'a'.repeat(5000))],
    });

    const respuesta = await servicio.responder(CTX, 'hola');

    expect(respuesta).toHaveLength(4096);
    expect(respuesta?.endsWith('…')).toBe(true);
  });

  it('en canales sociales formatea el texto sin asteriscos de Markdown', async () => {
    const ctxMessenger: ContextoHerramienta = {
      canal: 'messenger',
      identificadorExterno: 'psid-1',
      telefono: null,
      conversacionId: 'cv-2',
    };
    const { servicio } = crearServicio({
      respuestas: [texto('r-1', '**Hawaiana**\n* jamón y piña\n*Especial*')],
    });

    await expect(servicio.responder(ctxMessenger, 'menú')).resolves.toBe(
      'Hawaiana\n- jamón y piña\nEspecial',
    );
  });

  it('en canales sociales sin configurar ofrece humano con comillas', async () => {
    const ctxInstagram: ContextoHerramienta = {
      canal: 'instagram',
      identificadorExterno: 'igsid-1',
      telefono: null,
      conversacionId: 'cv-3',
    };
    const { servicio } = crearServicio({ configurado: false });

    await expect(servicio.responder(ctxInstagram, 'hola')).resolves.toContain(
      'escribí "humano"',
    );
  });

  it('envía system_instruction para el canal correspondiente e indica si es inicio', async () => {
    const ctxInstagram: ContextoHerramienta = {
      canal: 'instagram',
      identificadorExterno: 'igsid-1',
      telefono: null,
      conversacionId: 'cv-3',
    };
    const { servicio, llamadas } = crearServicio({
      respuestas: [texto('r-1', 'Hola')],
    });

    await servicio.responder(ctxInstagram, 'hola');

    expect(llamadas[0]?.system_instruction).toContain(
      'Respondés por Instagram Direct',
    );
    expect(llamadas[0]?.system_instruction).toContain(
      'Aviso inicial obligatorio',
    );
  });
});
