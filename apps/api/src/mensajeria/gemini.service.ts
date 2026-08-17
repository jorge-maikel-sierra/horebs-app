import { Injectable, Logger } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import { PedidosService } from '../pedidos/pedidos.service';
import { MetaGraphService } from './meta-graph.service';
import { ConversacionesService, type CanalMensajeria } from './conversaciones.service';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const MODELO_DEFAULT = 'gemini-flash-lite-latest';
const MAX_TURNOS_HERRAMIENTAS = 4;

// Datos reales de CLAUDE.md — el modelo nunca los inventa, siempre los
// recibe a través de la herramienta obtener_horario.
const HORARIO = 'Lunes a domingo, 4:00pm – 11:00pm';
const DIRECCION = 'Carrera 7 # 17B - 66, Riohacha, La Guajira';
const NOMBRE_NEGOCIO = 'Pizzería Horebs';
const URL_CATALOGO = 'https://pizzeriahorebs.shop/catalogo';

const SYSTEM_INSTRUCTION = `Sos el asistente virtual de ${NOMBRE_NEGOCIO}, una pizzería en Riohacha, La Guajira, Colombia. Respondés por WhatsApp con un tono cercano, cálido y directo, como una persona real del equipo — no como un robot.

Reglas estrictas:
- Nunca inventes precios, productos, horarios ni el estado de un pedido. Para cualquiera de esos datos, usá siempre la herramienta correspondiente.
- Si el cliente pide el menú o catálogo en general (sin nombrar un producto puntual), usá enviar_link_catalogo — NO listes todos los precios en el mensaje, eso ya lo manda la herramienta como un botón.
- Si el cliente pregunta por un producto específico (por ejemplo "cuánto vale la pizza hawaiana", "tienen pizza margarita personal"), usá consultar_producto con el nombre de ese producto.
- Si el pedido del cliente es vago o genérico (por ejemplo "quiero más información", "contame más", "necesito ayuda") y no queda claro qué dato específico necesita, NO llames a ninguna herramienta todavía — preguntale primero si quiere ver el menú, el horario, el estado de su pedido, o hablar con alguien del equipo. Usá una herramienta recién cuando el cliente ya haya aclarado qué necesita.
- Si te preguntan algo que ninguna herramienta puede responder, o el cliente pide hablar con alguien del equipo, usá la herramienta derivar_a_humano.
- Mantené las respuestas breves — como un mensaje real de WhatsApp, no un párrafo largo.
- No prometas descuentos, promociones ni tiempos de entrega exactos que no te haya dado una herramienta.`;

const HERRAMIENTAS = [
  {
    type: 'function',
    name: 'enviar_link_catalogo',
    description:
      'Manda el link del catálogo completo con fotos como botón de WhatsApp. Usar cuando el cliente pide ver el menú o catálogo en general, sin preguntar por un producto puntual.',
    parameters: { type: 'object', properties: {} },
  },
  {
    type: 'function',
    name: 'consultar_producto',
    description: 'Busca el precio y descripción real de un producto específico del menú por nombre.',
    parameters: {
      type: 'object',
      properties: {
        nombre_producto: {
          type: 'string',
          description: 'Nombre del producto que pidió el cliente, ej. "pizza hawaiana"',
        },
      },
      required: ['nombre_producto'],
    },
  },
  {
    type: 'function',
    name: 'obtener_horario',
    description: 'Devuelve el horario de atención y la dirección del local.',
    parameters: { type: 'object', properties: {} },
  },
  {
    type: 'function',
    name: 'consultar_pedido',
    description:
      'Busca el estado del último pedido del cliente que está escribiendo, usando su número de teléfono.',
    parameters: { type: 'object', properties: {} },
  },
  {
    type: 'function',
    name: 'derivar_a_humano',
    description:
      'Marca la conversación para que la atienda una persona del equipo y deja de responder automáticamente.',
    parameters: { type: 'object', properties: {} },
  },
];

interface PasoFunctionCall {
  id: string;
  type: 'function_call';
  name: string;
  arguments: Record<string, unknown>;
}

interface PasoModelOutput {
  type: 'model_output';
  content: { type: string; text: string }[];
}

interface RespuestaInteraction {
  id: string;
  status: 'completed' | 'requires_action';
  steps: (PasoFunctionCall | PasoModelOutput | { type: string })[];
}

/**
 * Function-calling contra la Interactions API de Gemini: el modelo decide
 * qué herramienta llamar, pero el dato real siempre sale de Supabase vía
 * los mismos servicios que ya usa el resto del sistema — el modelo nunca
 * inventa precios, horarios ni estados de pedido.
 */
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly apiKey?: string;
  private readonly modelo: string;

  constructor(
    private readonly catalog: CatalogService,
    private readonly pedidos: PedidosService,
    private readonly conversaciones: ConversacionesService,
    private readonly metaGraph: MetaGraphService,
  ) {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.modelo = process.env.GEMINI_MODEL || MODELO_DEFAULT;
    if (!this.apiKey) {
      this.logger.warn('GEMINI_API_KEY no configurada — el bot no puede responder.');
    }
  }

  /**
   * Devuelve `null` cuando la herramienta ya mandó el mensaje ella misma
   * (el botón de catálogo) — en ese caso no hay que enviar nada más.
   */
  async responder(
    canal: CanalMensajeria,
    identificadorExterno: string,
    telefono: string | null,
    textoEntrante: string,
  ): Promise<string | null> {
    if (!this.apiKey) {
      return 'En este momento no puedo responder automáticamente — escribí *humano* para que te atienda alguien del equipo.';
    }

    let respuesta = await this.llamarGemini({
      model: this.modelo,
      system_instruction: SYSTEM_INSTRUCTION,
      input: textoEntrante,
      tools: HERRAMIENTAS,
    });

    for (let turno = 0; turno < MAX_TURNOS_HERRAMIENTAS; turno++) {
      const llamada = respuesta.steps.find(
        (p): p is PasoFunctionCall => p.type === 'function_call',
      );
      if (!llamada || respuesta.status !== 'requires_action') break;

      if (llamada.name === 'enviar_link_catalogo') {
        await this.metaGraph.enviarBotonCatalogo(canal, identificadorExterno, URL_CATALOGO);
        return null;
      }

      const resultado = await this.ejecutarHerramienta(
        llamada.name,
        llamada.arguments,
        canal,
        identificadorExterno,
        telefono,
      );

      respuesta = await this.llamarGemini({
        model: this.modelo,
        previous_interaction_id: respuesta.id,
        input: {
          type: 'function_result',
          call_id: llamada.id,
          name: llamada.name,
          result: [{ type: 'text', text: resultado }],
        },
      });
    }

    const salida = respuesta.steps.find(
      (p): p is PasoModelOutput => p.type === 'model_output',
    );
    return salida?.content[0]?.text ?? 'Perdón, no pude procesar tu mensaje. Escribí *humano* para hablar con alguien del equipo.';
  }

  private async ejecutarHerramienta(
    nombre: string,
    argumentos: Record<string, unknown>,
    canal: CanalMensajeria,
    identificadorExterno: string,
    telefono: string | null,
  ): Promise<string> {
    try {
      switch (nombre) {
        case 'consultar_producto':
          return await this.textoProducto(String(argumentos.nombre_producto ?? ''));
        case 'obtener_horario':
          return `Horario: ${HORARIO}\nDirección: ${DIRECCION}`;
        case 'consultar_pedido':
          return await this.textoPedido(telefono);
        case 'derivar_a_humano':
          await this.conversaciones.derivarAHumano(canal, identificadorExterno);
          return 'Conversación derivada a una persona del equipo.';
        default:
          return 'Herramienta desconocida.';
      }
    } catch (err) {
      this.logger.error(`Error ejecutando herramienta ${nombre}: ${(err as Error).message}`);
      return 'No se pudo obtener esta información en este momento.';
    }
  }

  private async textoProducto(nombreBuscado: string): Promise<string> {
    const normalizar = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    const buscado = normalizar(nombreBuscado);
    const productos = await this.catalog.getProductos();
    const encontrado = productos.find((p) => {
      const nombre = normalizar(p.nombre);
      return nombre.includes(buscado) || buscado.includes(nombre);
    });
    if (!encontrado) {
      return `No se encontró un producto llamado "${nombreBuscado}" en el catálogo. Ofrecé mandar el link completo con enviar_link_catalogo.`;
    }
    const variantes = encontrado.variantes
      .map((v) => `${v.nombre}: $${(v.precio_oferta ?? v.precio).toLocaleString('es-CO')}`)
      .join(', ');
    return `${encontrado.nombre}${encontrado.descripcion ? ` — ${encontrado.descripcion}` : ''}. Precios: ${variantes}`;
  }

  private async textoPedido(telefono: string | null): Promise<string> {
    if (!telefono) {
      return 'No se pudo identificar el número de teléfono del cliente en este canal.';
    }
    const pedidos = await this.pedidos.buscarPorTelefono(telefono);
    if (pedidos.length === 0) {
      return 'No se encontraron pedidos asociados a este número de teléfono.';
    }
    const ultimo = pedidos[0];
    const items = ultimo.items
      .map((i) => `${i.cantidad}x ${i.producto_nombre}${i.variante_nombre ? ` (${i.variante_nombre})` : ''}`)
      .join(', ');
    return `Último pedido — estado: ${ultimo.estado}. Items: ${items}. Total: $${ultimo.total.toLocaleString('es-CO')}`;
  }

  private async llamarGemini(body: Record<string, unknown>): Promise<RespuestaInteraction> {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'x-goog-api-key': this.apiKey as string,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detalle = await res.text();
      throw new Error(`Gemini respondió ${res.status}: ${detalle}`);
    }
    return res.json();
  }
}
