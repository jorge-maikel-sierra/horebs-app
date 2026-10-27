import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CatalogService,
  entraEnCatalogoMeta,
} from '../catalog/catalog.service';
import { PedidosService } from '../pedidos/pedidos.service';
import { MetaGraphService } from './meta-graph.service';
import { ConversionesMetaService } from './conversiones-meta.service';
import { COSTO_DOMICILIO_DEFAULT } from '../common/costos';
import {
  buscarProductoUnico,
  contieneNumeroNoVerificado,
  elegirVariante,
  palabrasSignificativas,
} from './busqueda-productos';
import { armarResumenPedido, type LineaPedido } from './resumen-pedido';
// Mensaje fijo para cerrar la conversación recién al derivar — antes el
// modelo componía su propio cierre y en producción llegó a decir "tu
// pedido ya quedó registrado" con un tiempo de entrega inventado.
import { AvisoEquipoService, MENSAJE_DERIVACION } from './aviso-equipo.service';
import { CheckoutWhatsappService } from './checkout-whatsapp.service';
import {
  ConversacionesService,
  type CanalMensajeria,
  type ItemCarritoPendiente,
  type ModalidadPedido,
} from './conversaciones.service';

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/interactions';
const MODELO_DEFAULT = 'gemini-flash-lite-latest';
const MAX_TURNOS_HERRAMIENTAS = 4;
// Medido en producción (oct 2026): un prompt mínimo tardó entre 5 y 28s
// con el mismo modelo. Con 20s se cortaban respuestas que igual llegaban;
// el webhook ya le respondió 200 a Meta, así que esperar más no tiene costo
// del lado de Meta — solo demora la respuesta al cliente.
const TIMEOUT_GEMINI_MS = 45_000;
// Un solo reintento ante corte o error transitorio (429/5xx): más de eso
// deja al cliente esperando minutos por una respuesta.
const REINTENTOS_GEMINI = 1;
const LIMITE_MENSAJES_VENTANA_MINUTOS = 60;
const LIMITE_MENSAJES_MAX = 40;
// WhatsApp rechaza mensajes de más de 4096 caracteres.
const MAX_LARGO_MENSAJE_WHATSAPP = 4096;

/**
 * El modelo tiene la instrucción de usar un solo asterisco (el formato real
 * de WhatsApp), pero en la práctica sigue devolviendo negrita estilo
 * Markdown (**texto**) y viñetas ("* texto") con bastante frecuencia — un
 * "lite" no obedece esto de forma confiable solo con el prompt. Se corrige
 * acá, determinístico, en vez de confiar en que el modelo lo haga bien.
 */
function formatearParaWhatsapp(texto: string): string {
  return texto
    .replace(/^[ \t]*\*[ \t]+/gm, '- ')
    .replace(/\*\*(.+?)\*\*/g, '*$1*');
}

// Datos reales de CLAUDE.md — el modelo nunca los inventa, siempre los
// recibe a través de la herramienta obtener_horario.
const HORARIO = 'Lunes a domingo, 4:00pm – 11:00pm';
const DIRECCION = 'Carrera 7 # 17B - 66, Riohacha, La Guajira';
const NOMBRE_NEGOCIO = 'Pizzería Horebs';
const URL_CATALOGO = 'https://pizzeriahorebs.shop/catalogo';

// Igual criterio que HORARIO/DIRECCION — dato real de CLAUDE.md, entregado
// solo a través de obtener_tamanos_pizza. Antes no existía en ningún lado
// del sistema, así que el modelo lo inventaba cuando le preguntaban.
const TAMANOS_PIZZA =
  'Personal: 6 porciones, 24 centímetros de diámetro. ' +
  'Mediana: 8 porciones, 30 centímetros de diámetro. ' +
  'Grande: 12 porciones, 40 centímetros de diámetro.';

// Se agrega a todo resultado fallido de calcular_pedido. En producción
// (oct 2026), con calcular_pedido fallando, el modelo inventó un total
// ($23.500 en vez de $39.000) y una cuenta de pago que no existe.
const SIN_TOTAL_INVENTADO =
  'NO le des al cliente ningún total, precio sumado ni dato de pago: todavía no hay un total real. Aclarale lo que falta y, si no se puede resolver, usá derivar_a_humano.';

const SYSTEM_INSTRUCTION = `Sos el asistente virtual de ${NOMBRE_NEGOCIO}, una pizzería en Riohacha, La Guajira, Colombia. Respondés por WhatsApp con un tono cercano, cálido y directo, como una persona real del equipo — no como un robot.

Reglas estrictas:
- Nunca inventes precios, productos, horarios, tamaños/porciones ni el estado de un pedido. Para cualquiera de esos datos, usá siempre la herramienta correspondiente y copiá el dato TAL CUAL te lo devuelve — nunca lo redondees, resumas ni cambies de memoria, aunque te "suene" distinto a lo que dijiste antes en la misma conversación.
- Si te preguntan cuántas porciones trae un tamaño (personal, mediana, grande) o cuántos centímetros de diámetro mide, usá SIEMPRE obtener_tamanos_pizza — nunca respondas esos datos de memoria, es un error frecuente y grave. Si el cliente pregunta por el diámetro directamente (por ejemplo "la de 40 cm", "la de 30"), es el mismo dato en otra unidad — traducilo vos: 24cm=personal, 30cm=mediana, 40cm=grande.
- Cuando alguien pregunte por un tamaño (en cm, en porciones, o diciendo "la grande"/"la mediana") sin haber elegido todavía un producto puntual, no te quedes en el dato de tamaño solo — recomendale un producto real de ese tamaño con su precio, usando consultar_producto o mostrar_productos, para ayudarlo a decidir y avanzar hacia el pedido en vez de dejarlo con una respuesta genérica.
- Pizzería Horebs tiene UNA sola sede — nunca le preguntes al cliente en qué local, sucursal o negocio quiere hacer su pedido, ni le des a elegir entre sedes. La modalidad "local" significa comer ahí mismo, en la única dirección del negocio.
- El costo de domicilio SIEMPRE es el que te devuelve una herramienta (obtener_horario si preguntan antes de armar un pedido, calcular_pedido si ya lo están armando), literal — nunca digas "el domicilio es gratis" ni lo redondees a $0 salvo que la herramienta lo devuelva exactamente en $0. Es un error grave que ya pasó antes: perdés plata real de la pizzería si lo regalás por error.
- Si te preguntan cuánto cuesta el domicilio sin estar todavía armando un pedido, usá obtener_horario — ahí también viene ese dato real.
- Si te preguntan qué otros productos venden, o qué tienen aparte de pizza, usá obtener_categorias para responder con las categorías reales del catálogo — nunca digas "solo vendemos pizza" de memoria, hoy también hay panzerotti y bebidas.
- El objetivo de la conversación es cerrar la venta ahí mismo, sin que el cliente tenga que salir de WhatsApp — nunca le mandes links a otra página ni le digas que pida por el sitio web.
- Si el cliente pide el menú, la carta o el catálogo, o pregunta en general qué venden, usá enviar_catalogo — le llega el menú completo dentro de WhatsApp, con fotos, precios y carrito.
- Si el cliente pide opciones de una categoría o una recomendación (por ejemplo "qué pizzas tienen", "algo para tomar", "qué me recomendás"), usá mostrar_productos — le llega una lista con foto, precio por tamaño y botón para agregar al carrito. NO listes productos ni precios vos en el mensaje, eso ya lo manda la herramienta.
- Si el cliente pregunta por un producto específico (por ejemplo "cuánto vale la pizza hawaiana", "tienen pizza margarita personal"), usá consultar_producto con el nombre de ese producto. Si la herramienta te dice que no lo encontró, decile simplemente que no tenemos ese producto en el menú y ofrecele mandarle el menú — nunca le preguntes de qué local o pizzería está hablando, vos ya sabés que sos el asistente de Pizzería Horebs.
- Cuando el mensaje del cliente empiece con "Envié mi carrito del catálogo:", esos son los productos, tamaños y cantidades de su pedido (ya validados contra el menú) — NO se los vuelvas a preguntar ni le muestres el menú de nuevo. Confirmale en una línea lo que eligió y seguí el flujo de toma de pedido desde el paso 2 (modalidad, dirección si es domicilio, nombre completo). Ese carrito queda guardado en el sistema: al llamar calcular_pedido NO repitas sus productos en items (dejá items vacío, o poné solo lo que el cliente agregue aparte por escrito). Si quiere cambiar algo del carrito, pedile que lo edite y lo vuelva a mandar desde el catálogo. Si el mensaje dice que algún producto ya no está disponible, avisale con amabilidad y preguntale si quiere reemplazarlo. Si dice que ninguno está disponible, pedile disculpas y ofrecele mandarle el menú con enviar_catalogo. Si trae una "Nota:", tenela en cuenta.
- Nunca inventes opciones, sabores, tamaños ni productos: solo ofrecé las opciones exactas que te devolvió una herramienta. Si una herramienta te lista opciones, copialas tal cual.
- Cuando el mensaje del cliente sea "Quiero pedir <nombre de producto>" (esto pasa cuando toca el botón "Agregar al pedido" de una tarjeta), tratalo como el inicio de un pedido de ese producto — seguí el flujo normal de toma de pedido de abajo, preguntando el tamaño si el producto tiene más de uno.
- Si el pedido del cliente es vago o genérico (por ejemplo "quiero más información", "contame más", "necesito ayuda") y no queda claro qué dato específico necesita, NO llames a ninguna herramienta todavía — preguntale primero si quiere ver el menú, el horario, el estado de su pedido, o hablar con alguien del equipo. Usá una herramienta recién cuando el cliente ya haya aclarado qué necesita.
- Si te preguntan algo que ninguna herramienta puede responder, o el cliente pide hablar con alguien del equipo, usá la herramienta derivar_a_humano.
- Si es el primer mensaje de la conversación (todavía no tenés ningún mensaje anterior en el historial), usá SIEMPRE obtener_cliente_registrado antes de responder — si te devuelve un nombre, saludalo por su nombre de pila en tu primera respuesta; si te dice que no hay cliente registrado, saludá de forma normal sin usar ningún nombre. Nunca vuelvas a llamar esta herramienta en mensajes posteriores de la misma conversación, y nunca inventes un nombre que la herramienta no te haya devuelto.
- Mantené las respuestas breves — como un mensaje real de WhatsApp, no un párrafo largo.
- No prometas descuentos, promociones ni tiempos de entrega exactos que no te haya dado una herramienta.
- NUNCA des números de cuenta, llaves, Nequi, Daviplata, bancos ni ningún dato para transferir o pagar, y nunca le pidas al cliente que pague o mande un comprobante — esos datos los da una persona del equipo cuando confirma el pedido. Es un error grave que ya pasó: el bot inventó una cuenta que no existe.
- Un total o un precio sumado solo se le da al cliente si sale de calcular_pedido en este mismo pedido. Si calcular_pedido devuelve un error, no hay total: nunca lo calcules ni lo estimes vos.
- Para resaltar una palabra o un dato (un total, una dirección, un método de pago) usá UN SOLO asterisco de cada lado, como *esto* — WhatsApp no interpreta el doble asterisco de Markdown (**esto**) y lo muestra literal, con los asteriscos de más.

Cómo tomar un pedido (importante, seguí este orden):
1. Cuando el cliente quiera pedir algo, andá anotando los productos, tamaños y cantidades a medida que los va diciendo — podés ir preguntando de a uno si hace falta.
2. Preguntá si es para domicilio, para retirar, o para comer en el local. Si es domicilio, pedí la dirección.
3. Antes de calcular el total, pedile el nombre COMPLETO (nombre y apellido) de quien hace el pedido — es obligatorio, no lo saltees aunque ya venga charlando hace rato. Si solo da un nombre, preguntale el apellido también.
4. Cuando el cliente confirme que ya terminó de elegir todo y ya te dio su nombre completo, usá calcular_pedido con los items pedidos por escrito (sin repetir los del carrito del catálogo), el nombre, el apellido, la modalidad (SOLO "domicilio", "retiro" o "local" — nunca metas la dirección ahí) y la dirección en el campo direccion si es domicilio — esa herramienta calcula el total real con los precios del catálogo, incluyendo el domicilio. NUNCA sumes los precios vos mismo ni inventes el costo del domicilio.
5. Si calcular_pedido sale bien, el sistema le manda al cliente el resumen exacto y la pregunta del método de pago — vos no tenés que repetir el resumen ni el total. Si devuelve un error, aclarale al cliente lo que falta. En WhatsApp, cuando el cliente elige el método de pago el sistema registra el pedido solo y se lo confirma — vos no tenés que hacer nada más.
6. Solo fuera de WhatsApp (Messenger o Instagram): apenas el cliente te diga el método de pago, usá derivar_a_humano para que una persona del equipo verifique y registre el pedido — copiá el mensaje que te devuelve esa herramienta TAL CUAL, es el único cierre permitido. Es un error grave que ya pasó antes: un cliente real terminó pensando que su pedido ya estaba confirmado y listo para retirar en 20-30 minutos, sin que nadie del equipo se enterara, porque nunca se llamó a derivar_a_humano. NUNCA digas "tu pedido ya quedó registrado", "ya fue registrado", ni dés un tiempo de entrega o de recogida de tu propia cuenta — eso no lo sabés vos.
- El número de teléfono de contacto ya lo tenés (es el mismo WhatsApp desde el que te escribe) — no hace falta pedirlo aparte.`;

const HERRAMIENTAS = [
  {
    type: 'function',
    name: 'enviar_catalogo',
    description:
      'Manda el menú completo como catálogo dentro de WhatsApp (fotos, precios y carrito, sin salir del chat). Usar cuando el cliente pide el menú, la carta, el catálogo, o pregunta en general qué venden.',
    parameters: { type: 'object', properties: {} },
  },
  {
    type: 'function',
    name: 'mostrar_productos',
    description:
      'Manda una lista de productos del catálogo dentro de WhatsApp (foto, precio por tamaño y botón para agregar al carrito). Usar cuando el cliente pide opciones de una categoría (ej. "qué pizzas tienen", "algo para tomar") o pide una recomendación — nunca listes productos ni precios vos mismo en el mensaje.',
    parameters: {
      type: 'object',
      properties: {
        consulta: {
          type: 'string',
          description:
            'Lo que el cliente busca, en sus palabras (ej. "pizzas", "algo para tomar", "pizza hawaiana personal"). Dejar vacío si el cliente no especificó nada — en ese caso se muestran los productos más populares.',
        },
      },
    },
  },
  {
    type: 'function',
    name: 'consultar_producto',
    description:
      'Busca el precio y descripción real de un producto específico del menú por nombre.',
    parameters: {
      type: 'object',
      properties: {
        nombre_producto: {
          type: 'string',
          description:
            'Nombre del producto que pidió el cliente, ej. "pizza hawaiana"',
        },
      },
      required: ['nombre_producto'],
    },
  },
  {
    type: 'function',
    name: 'calcular_pedido',
    description:
      'Calcula el total real de un pedido con los productos, tamaños y cantidades que el cliente eligió, incluyendo el costo de domicilio si aplica. Usar solo cuando el cliente ya terminó de elegir todo lo que quiere pedir Y ya dio su nombre completo (nombre y apellido).',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description:
            'Productos pedidos por escrito. Si el cliente mandó un carrito del catálogo, ese carrito YA está guardado y se suma solo: NO repitas sus productos acá — poné solo lo que agregó aparte por escrito, o dejá la lista vacía.',
          items: {
            type: 'object',
            properties: {
              producto: {
                type: 'string',
                description:
                  'Nombre del producto, ej. "pizza hawaiana" o "Coca-Cola 400ml"',
              },
              tamano: {
                type: 'string',
                description:
                  'Tamaño o variante elegida, tal cual figura en el menú: personal, mediana o grande para pizzas; vacío si el producto no tiene tamaños.',
              },
              cantidad: { type: 'number', description: 'Cantidad de unidades' },
            },
            required: ['producto', 'cantidad'],
          },
        },
        nombre: {
          type: 'string',
          description:
            'Nombre de pila de quien hace el pedido — obligatorio, preguntárselo si todavía no lo dio.',
        },
        apellido: {
          type: 'string',
          description:
            'Apellido de quien hace el pedido — obligatorio, preguntárselo si todavía no lo dio.',
        },
        modalidad: {
          type: 'string',
          enum: ['domicilio', 'retiro', 'local'],
          description:
            'Modalidad de entrega — exactamente uno de estos tres valores, sin agregarle la dirección ni nada más.',
        },
        direccion: {
          type: 'string',
          description:
            'Dirección de entrega. Solo si modalidad es "domicilio" — vacío en los otros casos.',
        },
      },
      required: ['nombre', 'apellido', 'modalidad'],
    },
  },
  {
    type: 'function',
    name: 'obtener_horario',
    description:
      'Devuelve el horario de atención, la dirección del local, y el costo de domicilio. Usar también cuando pregunten cuánto cuesta el domicilio sin estar todavía armando un pedido.',
    parameters: { type: 'object', properties: {} },
  },
  {
    type: 'function',
    name: 'obtener_categorias',
    description:
      'Devuelve las categorías de productos que vende el negocio (ej. Pizza, Panzerotti, Bebidas). Usar cuando pregunten qué otros productos venden, o qué tienen aparte de pizza.',
    parameters: { type: 'object', properties: {} },
  },
  {
    type: 'function',
    name: 'obtener_tamanos_pizza',
    description:
      'Devuelve cuántas porciones trae y cuántos centímetros de diámetro mide cada tamaño de pizza (personal, mediana, grande). Usar siempre que pregunten por porciones, "para cuántos alcanza", o el tamaño/diámetro en centímetros — nunca responder esos datos de memoria.',
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
    name: 'obtener_cliente_registrado',
    description:
      'Busca si el número de teléfono de quien escribe ya pertenece a un cliente registrado, y devuelve su nombre si existe. Usar SIEMPRE en el primer mensaje de una conversación nueva, antes de responder — nunca en mensajes posteriores de la misma conversación.',
    parameters: { type: 'object', properties: {} },
  },
  {
    type: 'function',
    name: 'derivar_a_humano',
    description:
      'Marca la conversación para que la atienda una persona del equipo y deja de responder automáticamente. Usar también al final de tomar un pedido, una vez que el cliente ya dio el método de pago.',
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
  // Opcional de verdad — un response real en producción llegó sin este
  // campo (API en beta), ver el uso con (respuesta.steps ?? []) abajo.
  steps?: (PasoFunctionCall | PasoModelOutput | { type: string })[];
  // No documentados de forma estable en esta API en beta — se loguean si
  // vienen, para poder correlacionar un cambio de comportamiento con un
  // alias de modelo o un consumo de tokens puntual, sin depender de que
  // existan (el pinning de modelo por alias es una decisión consciente,
  // ver README de mensajeria/).
  model?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

type Producto = Awaited<ReturnType<CatalogService['getProductos']>>[number];

/**
 * Corte por timeout, 429, 5xx o un function call mal formado por el
 * modelo: vale la pena reintentar. Otro 4xx no.
 */
class ErrorTransitorioGemini extends ServiceUnavailableException {}

type ResultadoCalculo =
  | {
      ok: true;
      items: ItemCarritoPendiente[];
      lineas: LineaPedido[];
      datos: {
        modalidad: ModalidadPedido;
        direccion?: string;
        nombre: string;
        apellido: string;
      };
    }
  | { ok: false; texto: string };

/**
 * Function-calling contra la Interactions API de Gemini, con memoria de
 * conversación entre mensajes separados vía `previous_interaction_id`
 * (persistido en conversaciones_bot). El modelo decide qué herramienta
 * llamar, pero el dato real siempre sale de Supabase vía los mismos
 * servicios que ya usa el resto del sistema — nunca inventa precios,
 * horarios, ni suma totales por su cuenta.
 */
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly apiKey?: string;
  private readonly modelo: string;

  constructor(
    private readonly config: ConfigService,
    private readonly catalog: CatalogService,
    private readonly pedidos: PedidosService,
    private readonly conversaciones: ConversacionesService,
    private readonly metaGraph: MetaGraphService,
    private readonly conversionesMeta: ConversionesMetaService,
    private readonly avisoEquipo: AvisoEquipoService,
    private readonly checkout: CheckoutWhatsappService,
  ) {
    this.apiKey = this.config.get<string>('GEMINI_API_KEY');
    this.modelo = this.config.get<string>('GEMINI_MODEL') || MODELO_DEFAULT;
    if (!this.apiKey) {
      this.logger.warn(
        'GEMINI_API_KEY no configurada — el bot no puede responder.',
      );
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
    conversacionId: string,
  ): Promise<string | null> {
    if (!this.apiKey) {
      return 'En este momento no puedo responder automáticamente — escribí *humano* para que te atienda alguien del equipo.';
    }

    try {
      const dentroDelLimite =
        await this.conversaciones.dentroDelLimiteDeMensajes(
          canal,
          identificadorExterno,
          LIMITE_MENSAJES_VENTANA_MINUTOS,
          LIMITE_MENSAJES_MAX,
        );
      if (!dentroDelLimite) {
        this.logger.warn(
          `Límite de mensajes excedido — canal=${canal} id=${identificadorExterno}`,
        );
        return this.truncarParaWhatsapp(
          'Estás mandando muchos mensajes seguidos — dame un momento o escribí *humano* para que te atienda alguien del equipo.',
        );
      }

      const respuestaFinal = await this.conversarConGemini(
        canal,
        identificadorExterno,
        telefono,
        textoEntrante,
        conversacionId,
      );
      return respuestaFinal === null
        ? null
        : this.truncarParaWhatsapp(respuestaFinal);
    } catch (err) {
      this.logger.error(
        `Error respondiendo a canal=${canal} id=${identificadorExterno}: ${(err as Error).message}`,
      );
      return 'Perdón, tuve un problema para procesar tu mensaje. Escribí *humano* para hablar con alguien del equipo.';
    }
  }

  private truncarParaWhatsapp(texto: string): string {
    if (texto.length <= MAX_LARGO_MENSAJE_WHATSAPP) return texto;
    return `${texto.slice(0, MAX_LARGO_MENSAJE_WHATSAPP - 1)}…`;
  }

  private async conversarConGemini(
    canal: CanalMensajeria,
    identificadorExterno: string,
    telefono: string | null,
    textoEntrante: string,
    conversacionId: string,
  ): Promise<string | null> {
    const interaccionPrevia =
      await this.conversaciones.obtenerUltimaInteraccionGemini(
        canal,
        identificadorExterno,
      );

    let respuesta = await this.llamarGemini({
      model: this.modelo,
      system_instruction: SYSTEM_INSTRUCTION,
      tools: HERRAMIENTAS,
      ...(interaccionPrevia
        ? { previous_interaction_id: interaccionPrevia, input: textoEntrante }
        : { input: textoEntrante }),
    });

    let derivadoEnEsteTurno = false;
    // Fuentes válidas para un número largo en la respuesta: lo que devolvió
    // una herramienta en este turno, o lo que acaba de escribir el cliente.
    const resultadosHerramientas: string[] = [textoEntrante];

    for (let turno = 0; turno < MAX_TURNOS_HERRAMIENTAS; turno++) {
      // (respuesta.steps ?? []) — la Interactions API de Gemini está en
      // beta y en algún response real llegó sin steps, tirando "Cannot
      // read properties of undefined (reading 'find')" (visto en logs de
      // producción); mejor tratarlo como "sin function_call" que romper
      // la conversación con un error genérico.
      const llamada = (respuesta.steps ?? []).find(
        (p): p is PasoFunctionCall => p.type === 'function_call',
      );
      if (!llamada || respuesta.status !== 'requires_action') break;

      if (llamada.name === 'enviar_catalogo') {
        const enviado = await this.metaGraph.enviarCatalogo(
          canal,
          identificadorExterno,
          URL_CATALOGO,
          await this.retailerIdMiniatura(),
        );
        await this.conversaciones.registrarMensaje(
          conversacionId,
          'saliente_bot',
          enviado === 'catalogo'
            ? 'Menú enviado como catálogo de WhatsApp.'
            : `Mirá nuestro catálogo completo con fotos y precios acá: ${URL_CATALOGO}`,
        );
        await this.conversaciones.guardarInteraccionGemini(
          canal,
          identificadorExterno,
          respuesta.id,
        );
        return null;
      }

      if (llamada.name === 'mostrar_productos') {
        const consulta = String(llamada.arguments.consulta ?? '');
        const mostrados = await this.enviarProductos(
          canal,
          identificadorExterno,
          consulta,
        );
        if (mostrados.length > 0) {
          const textoProductos = `Productos mostrados: ${mostrados.join(', ')}`;
          await this.conversaciones.registrarMensaje(
            conversacionId,
            'saliente_bot',
            textoProductos,
          );
        }
        await this.conversaciones.guardarInteraccionGemini(
          canal,
          identificadorExterno,
          respuesta.id,
        );
        return null;
      }

      if (llamada.name === 'derivar_a_humano') derivadoEnEsteTurno = true;

      let resultado: string;
      if (llamada.name === 'calcular_pedido') {
        const calculo = await this.calcularPedido(
          llamada.arguments,
          canal,
          identificadorExterno,
        );
        if (calculo.ok) {
          await this.enviarResumenPedido(
            canal,
            identificadorExterno,
            conversacionId,
            calculo,
            respuesta.id,
            llamada.id,
          );
          return null;
        }
        resultado = calculo.texto;
      } else {
        resultado = await this.ejecutarHerramienta(
          llamada.name,
          llamada.arguments,
          canal,
          identificadorExterno,
          telefono,
          conversacionId,
        );
      }
      resultadosHerramientas.push(resultado);
      // Solo la primera línea: el resumen de calcular_pedido trae nombre y
      // dirección del cliente en las siguientes.
      this.logger.log(
        `id=${identificadorExterno} herramienta=${llamada.name} → ${resultado.split('\n')[0].slice(0, 160)}`,
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

    // Si se derivó a humano, derivarAHumano() ya dejó gemini_interaction_id
    // en null a propósito — no lo pisamos acá, así la próxima vez que el
    // bot retome la conversación arranca de cero.
    if (!derivadoEnEsteTurno) {
      await this.conversaciones.guardarInteraccionGemini(
        canal,
        identificadorExterno,
        respuesta.id,
      );
    }

    this.logger.log(
      `canal=${canal} id=${identificadorExterno} modelo=${respuesta.model ?? this.modelo}` +
        (respuesta.usage
          ? ` tokens_in=${respuesta.usage.input_tokens ?? '?'} tokens_out=${respuesta.usage.output_tokens ?? '?'}`
          : ''),
    );

    const salida = (respuesta.steps ?? []).find(
      (p): p is PasoModelOutput => p.type === 'model_output',
    );
    const texto = salida?.content[0]?.text;
    if (texto && contieneNumeroNoVerificado(texto, resultadosHerramientas)) {
      // Un número largo (cuenta, Nequi, teléfono) que ninguna herramienta
      // devolvió es un dato inventado: no se manda, y una persona sigue.
      this.logger.warn(
        `id=${identificadorExterno} respuesta bloqueada: número no verificado — se deriva a una persona.`,
      );
      await this.ejecutarHerramienta(
        'derivar_a_humano',
        {},
        canal,
        identificadorExterno,
        telefono,
        conversacionId,
      );
      return MENSAJE_DERIVACION;
    }
    return formatearParaWhatsapp(
      texto ??
        'Perdón, no pude procesar tu mensaje. Escribí *humano* para hablar con alguien del equipo.',
    );
  }

  private async ejecutarHerramienta(
    nombre: string,
    argumentos: Record<string, unknown>,
    canal: CanalMensajeria,
    identificadorExterno: string,
    telefono: string | null,
    conversacionId: string,
  ): Promise<string> {
    try {
      switch (nombre) {
        case 'consultar_producto':
          return await this.textoProducto(
            String(argumentos.nombre_producto ?? ''),
          );
        case 'obtener_horario':
          return `Horario: ${HORARIO}\nDirección: ${DIRECCION}\nCosto de domicilio: $${COSTO_DOMICILIO_DEFAULT.toLocaleString('es-CO')}`;
        case 'obtener_categorias':
          return await this.textoCategorias();
        case 'obtener_tamanos_pizza':
          return TAMANOS_PIZZA;
        case 'consultar_pedido':
          return await this.textoPedido(telefono);
        case 'obtener_cliente_registrado': {
          if (!telefono)
            return 'No se pudo identificar el número de teléfono del cliente en este canal.';
          const nombre = await this.pedidos.buscarNombrePorTelefono(telefono);
          return nombre
            ? `Cliente encontrado: ${nombre}.`
            : 'No se encontró ningún cliente registrado con este número de teléfono.';
        }
        case 'derivar_a_humano':
          await this.conversaciones.derivarAHumano(canal, identificadorExterno);
          this.avisoEquipo.notificar({
            canal,
            identificadorExterno,
            telefono,
            conversacionId,
          });
          void this.conversionesMeta.notificarLead(canal, identificadorExterno);
          return `Conversación derivada. Respondé al cliente con este mensaje EXACTO, sin cambiarlo ni agregar nada de "confirmado" o tiempos de entrega: "${MENSAJE_DERIVACION}"`;
        default:
          // En producción el modelo pidió herramientas que no existen
          // (obtener_sabores_pizza, obtener_menu_completo): se le devuelve
          // la lista real para que se corrija en la vuelta siguiente.
          return `La herramienta "${nombre}" no existe. Las únicas disponibles son: ${HERRAMIENTAS.map((h) => h.name).join(', ')}.`;
      }
    } catch (err) {
      this.logger.error(
        `Error ejecutando herramienta ${nombre}: ${(err as Error).message}`,
      );
      return 'No se pudo obtener esta información en este momento.';
    }
  }

  /** Variante del primer producto destacado del catálogo, para la portada. */
  private async retailerIdMiniatura(): Promise<string | undefined> {
    const productos = await this.catalog.getProductos();
    return productos.find(entraEnCatalogoMeta)?.variantes[0]?.id;
  }

  /**
   * Elige los productos que matchean `consulta`: primero por categoría
   * ("pizzas", "bebidas"), después por palabras del nombre/descripción
   * ordenadas por puntaje; si nada matchea o viene vacía, se usa el orden
   * por defecto de getProductos() (destacado primero — los productos ancla
   * confirmados en CLAUDE.md). En WhatsApp va como lista nativa del
   * catálogo agrupada por categoría; si no se puede, hasta 3 tarjetas.
   * Devuelve los nombres de lo que se mostró.
   */
  private async enviarProductos(
    canal: CanalMensajeria,
    identificadorExterno: string,
    consulta: string,
  ): Promise<string[]> {
    const [productos, categorias] = await Promise.all([
      this.catalog.getProductos(),
      this.catalog.getCategorias(),
    ]);
    if (productos.length === 0) return [];

    const elegidos = this.elegirProductos(productos, categorias, consulta);
    const tarjetas = elegidos.slice(0, 3).map((p) => ({
      nombre: p.nombre,
      descripcion: p.descripcion,
      imagenUrl: p.imagen_url,
      precioDesde: Math.min(
        ...p.variantes.map((v) => v.precio_oferta ?? v.precio),
      ),
    }));

    const enCatalogo = elegidos.filter(entraEnCatalogoMeta);
    const secciones = categorias
      .map((c) => ({
        titulo: c.nombre,
        productos: enCatalogo.filter((p) => p.categoria_id === c.id),
      }))
      .filter((s) => s.productos.length > 0);

    const enviado = await this.metaGraph.enviarListaProductos(
      canal,
      identificadorExterno,
      {
        encabezado:
          secciones.length === 1 ? secciones[0].titulo : NOMBRE_NEGOCIO,
        cuerpo: 'Tocá un producto para ver el detalle y agregalo al carrito 🛒',
        secciones: secciones.map((s) => ({
          titulo: s.titulo,
          retailerIds: s.productos.flatMap((p) => p.variantes.map((v) => v.id)),
        })),
      },
      tarjetas,
    );
    return enviado === 'lista'
      ? secciones.flatMap((s) => s.productos.map((p) => p.nombre))
      : tarjetas.map((t) => t.nombre);
  }

  /**
   * Orden de prioridad: un producto nombrado ("pizza hawaiana personal")
   * gana sobre su categoría; después la categoría ("pizzas", "bebidas");
   * después palabras de la descripción; y si nada matchea, todo el menú.
   */
  private elegirProductos(
    productos: Producto[],
    categorias: { id: string; nombre: string }[],
    consulta: string,
  ): Producto[] {
    const buscadas = palabrasSignificativas(consulta);
    const puntuar = (texto: (p: Producto) => string) =>
      productos
        .map((p) => ({
          producto: p,
          puntaje: palabrasSignificativas(texto(p)).filter((w) =>
            buscadas.includes(w),
          ).length,
        }))
        .filter((r) => r.puntaje > 0)
        .sort((a, b) => b.puntaje - a.puntaje)
        .map((r) => r.producto);

    const porNombre = puntuar((p) => p.nombre);
    if (porNombre.length > 0) return porNombre;

    // Raíz de 5 letras: "pizzas" → "pizza", "bebida" → "bebid". "pizza"
    // está entre las palabras ignoradas de arriba, por eso la categoría se
    // compara aparte.
    const raiz = (palabra: string) =>
      palabra.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 5);
    const raicesConsulta = consulta
      .split(/[^\p{L}0-9]+/u)
      .filter((w) => w.length > 3)
      .map(raiz);
    const categoriasPedidas = new Set(
      categorias
        .filter((c) => raicesConsulta.includes(raiz(c.nombre)))
        .map((c) => c.id),
    );
    if (categoriasPedidas.size > 0) {
      return productos.filter((p) => categoriasPedidas.has(p.categoria_id));
    }

    const porDescripcion = puntuar((p) => `${p.nombre} ${p.descripcion ?? ''}`);
    return porDescripcion.length > 0 ? porDescripcion : productos;
  }

  private async textoCategorias(): Promise<string> {
    const categorias = await this.catalog.getCategorias();
    if (categorias.length === 0) {
      return 'No se pudo obtener la lista de categorías en este momento.';
    }
    const nombres = categorias.map((c) => c.nombre).join(', ');
    return `Vendemos: ${nombres}.`;
  }

  private async textoProducto(nombreBuscado: string): Promise<string> {
    const productos = await this.catalog.getProductos();
    const { encontrado, error } = buscarProductoUnico(nombreBuscado, productos);
    if (error)
      return `${error} Si no se puede resolver, ofrecé mandarle el menú completo con enviar_catalogo.`;
    const variantes = encontrado!.variantes
      .map(
        (v) =>
          `${v.nombre}: $${(v.precio_oferta ?? v.precio).toLocaleString('es-CO')}`,
      )
      .join(', ');
    return `${encontrado!.nombre}${encontrado!.descripcion ? ` — ${encontrado!.descripcion}` : ''}. Precios: ${variantes}`;
  }

  /**
   * Total real del pedido. Los productos del carrito del catálogo salen
   * por id exacto de variante (guardado al recibir el carrito), sin que el
   * modelo los vuelva a nombrar; solo lo pedido aparte por escrito pasa por
   * la búsqueda por nombre. Si algo falla, devuelve el texto para el modelo
   * — nunca un total.
   */
  private async calcularPedido(
    argumentos: Record<string, unknown>,
    canal: CanalMensajeria,
    identificadorExterno: string,
  ): Promise<ResultadoCalculo> {
    const items = Array.isArray(argumentos.items)
      ? (argumentos.items as Record<string, unknown>[])
      : [];
    const nombre = String(argumentos.nombre ?? '').trim();
    const apellido = String(argumentos.apellido ?? '').trim();
    const modalidad = String(argumentos.modalidad ?? '').toLowerCase();
    const direccion = argumentos.direccion
      ? String(argumentos.direccion)
      : null;
    const fallo = (texto: string): ResultadoCalculo => {
      // Producto y tamaño pedidos, nunca datos del cliente.
      this.logger.warn(
        `id=${identificadorExterno} calcular_pedido falló — items=${JSON.stringify(items.map((i) => [i.producto, i.tamano, i.cantidad]))} → ${texto.slice(0, 160)}`,
      );
      return { ok: false, texto };
    };

    // Guardrail real, no solo la instrucción del prompt — si Gemini intenta
    // calcular sin nombre completo, esta herramienta se niega y lo manda a
    // preguntar, en vez de confiar en que el modelo siempre respete el
    // "required" del schema.
    if (!nombre || !apellido) {
      return fallo(
        'Todavía falta el nombre completo (nombre y apellido) de quien hace el pedido — preguntáselo al cliente antes de calcular el total.',
      );
    }
    if (!['domicilio', 'retiro', 'local'].includes(modalidad)) {
      return fallo(
        `Falta la modalidad: preguntale al cliente si es para domicilio, para retirar o para comer en el local. ${SIN_TOTAL_INVENTADO}`,
      );
    }
    if (modalidad === 'domicilio' && !direccion?.trim()) {
      return fallo(
        `Falta la dirección de entrega: preguntásela al cliente. ${SIN_TOTAL_INVENTADO}`,
      );
    }

    const carrito = await this.conversaciones.obtenerCarrito(
      canal,
      identificadorExterno,
    );
    const { disponibles } = await this.catalog.resolverCarrito(carrito);
    const lineas: LineaPedido[] = disponibles.map((i) => ({
      cantidad: i.cantidad,
      productoNombre: i.productoNombre,
      varianteNombre: i.conTamanos ? i.varianteNombre : null,
      precioUnitario: i.precio,
    }));
    // Ids exactos de todo lo que entra al pedido: el checkout con botones
    // crea el pedido con estos, sin volver a buscar por nombre.
    const itemsPedido = disponibles.map((i) => ({
      varianteId: i.varianteId,
      cantidad: i.cantidad,
    }));

    const productos = items.length > 0 ? await this.catalog.getProductos() : [];
    for (const item of items) {
      const nombreProducto = String(item.producto ?? '');
      const cantidadCruda = Math.round(Number(item.cantidad ?? 1)) || 1;
      const cantidad = Math.min(Math.max(cantidadCruda, 1), 20);
      const tamanoBuscado = item.tamano ? String(item.tamano) : null;

      const {
        encontrado,
        variante: varianteNombrada,
        error,
      } = buscarProductoUnico(nombreProducto, productos);
      if (error) {
        return fallo(
          `No se pudo calcular el pedido: ${error} ${SIN_TOTAL_INVENTADO}`,
        );
      }

      const variante =
        varianteNombrada ?? elegirVariante(encontrado!, tamanoBuscado);
      if (!variante) {
        const opciones = encontrado!.variantes.map((v) => v.nombre).join(', ');
        return fallo(
          `Para "${encontrado!.nombre}" falta saber cuál — opciones exactas: ${opciones}. Preguntale al cliente cuál quiere, ofreciendo solo esas opciones. ${SIN_TOTAL_INVENTADO}`,
        );
      }
      lineas.push({
        cantidad,
        productoNombre: encontrado!.nombre,
        varianteNombre:
          encontrado!.variantes.length > 1 ? variante.nombre : null,
        precioUnitario: variante.precio_oferta ?? variante.precio,
      });
      itemsPedido.push({ varianteId: variante.id, cantidad });
    }

    if (lineas.length === 0) {
      return fallo(
        `No hay productos para calcular: el cliente no mandó un carrito del catálogo ni pidió productos por escrito. Preguntale qué quiere pedir. ${SIN_TOTAL_INVENTADO}`,
      );
    }

    return {
      ok: true,
      items: itemsPedido,
      lineas,
      datos: {
        modalidad: modalidad as ModalidadPedido,
        direccion: direccion?.trim() || undefined,
        nombre,
        apellido,
      },
    };
  }

  /**
   * Manda el resumen armado por código y le avisa a Gemini que ya se envió.
   * En WhatsApp pasa al checkout con botones (paso de pago): el pedido se
   * crea con un toque, sin que el modelo intervenga. En Messenger/Instagram
   * se pregunta el pago por texto. Lo que Gemini conteste al aviso no se
   * manda al cliente.
   */
  private async enviarResumenPedido(
    canal: CanalMensajeria,
    identificadorExterno: string,
    conversacionId: string,
    calculo: Extract<ResultadoCalculo, { ok: true }>,
    interaccionId: string,
    llamadaId: string,
  ): Promise<void> {
    let resumen: string;
    if (canal === 'whatsapp') {
      resumen = await this.checkout.ofrecerPagoDesdeCalculo({
        identificadorExterno,
        conversacionId,
        items: calculo.items,
        checkout: { paso: 'pago', ...calculo.datos },
      });
    } else {
      resumen = `${
        armarResumenPedido({
          nombreCompleto: `${calculo.datos.nombre} ${calculo.datos.apellido}`,
          lineas: calculo.lineas,
          modalidad: calculo.datos.modalidad,
          direccion: calculo.datos.direccion ?? null,
          costoDomicilio: COSTO_DOMICILIO_DEFAULT,
        }).texto
      }\n\n¿Cuál va a ser tu método de pago: *efectivo*, *transferencia* o *tarjeta*?`;
      await this.metaGraph.enviarMensajeSesion(
        canal,
        identificadorExterno,
        resumen,
      );
      await this.conversaciones.registrarMensaje(
        conversacionId,
        'saliente_bot',
        resumen,
      );
    }
    this.logger.log(
      `id=${identificadorExterno} herramienta=calcular_pedido → resumen enviado por el sistema`,
    );
    const calculoEnviado = { resumen };
    try {
      const aviso = await this.llamarGemini({
        model: this.modelo,
        previous_interaction_id: interaccionId,
        input: {
          type: 'function_result',
          call_id: llamadaId,
          name: 'calcular_pedido',
          result: [
            {
              type: 'text',
              text: `El sistema ya le mandó al cliente este resumen y los botones del método de pago — no lo repitas:\n${calculoEnviado.resumen}\nCuando el cliente elija el método de pago, el sistema crea el pedido solo. Si escribe el método de pago en vez de tocar el botón, también lo toma el sistema.`,
            },
          ],
        },
      });
      await this.conversaciones.guardarInteraccionGemini(
        canal,
        identificadorExterno,
        aviso.id,
      );
    } catch (err) {
      // El cliente ya tiene su resumen: si Gemini no responde, se guarda
      // la interacción previa y la conversación sigue igual.
      this.logger.warn(
        `id=${identificadorExterno} no se pudo avisar a Gemini del resumen: ${(err as Error).message}`,
      );
      await this.conversaciones.guardarInteraccionGemini(
        canal,
        identificadorExterno,
        interaccionId,
      );
    }
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
      .map(
        (i) =>
          `${i.cantidad}x ${i.producto_nombre}${i.variante_nombre ? ` (${i.variante_nombre})` : ''}`,
      )
      .join(', ');
    return `Último pedido — estado: ${ultimo.estado}. Items: ${items}. Total: $${ultimo.total.toLocaleString('es-CO')}`;
  }

  private async llamarGemini(
    body: Record<string, unknown>,
  ): Promise<RespuestaInteraction> {
    for (let intento = 0; ; intento++) {
      try {
        return await this.llamarGeminiUnaVez(body);
      } catch (err) {
        if (
          !(err instanceof ErrorTransitorioGemini) ||
          intento >= REINTENTOS_GEMINI
        ) {
          throw err;
        }
        this.logger.warn(`${err.message} — reintentando una vez.`);
      }
    }
  }

  private async llamarGeminiUnaVez(
    body: Record<string, unknown>,
  ): Promise<RespuestaInteraction> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_GEMINI_MS);
    try {
      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: {
          'x-goog-api-key': this.apiKey as string,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const detalle = await res.text();
        const mensaje = `Gemini respondió ${res.status}: ${detalle}`;
        // malformed_tool_call: el modelo generó un JSON inválido para la
        // herramienta (visto en producción); Google indica reintentar.
        if (
          res.status === 429 ||
          res.status >= 500 ||
          detalle.includes('malformed_tool_call')
        ) {
          throw new ErrorTransitorioGemini(mensaje);
        }
        throw new ServiceUnavailableException(mensaje);
      }
      return await res.json();
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new ErrorTransitorioGemini(
          `Gemini no respondió en ${TIMEOUT_GEMINI_MS / 1000}s`,
        );
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}
