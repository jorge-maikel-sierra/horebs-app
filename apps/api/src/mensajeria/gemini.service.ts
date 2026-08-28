import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CatalogService } from '../catalog/catalog.service';
import { PedidosService } from '../pedidos/pedidos.service';
import { MetaGraphService } from './meta-graph.service';
import { COSTO_DOMICILIO_DEFAULT } from '../common/costos';
import {
  ConversacionesService,
  type CanalMensajeria,
} from './conversaciones.service';

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/interactions';
const MODELO_DEFAULT = 'gemini-flash-lite-latest';
const MAX_TURNOS_HERRAMIENTAS = 4;
const TIMEOUT_GEMINI_MS = 20_000;
const LIMITE_MENSAJES_VENTANA_MINUTOS = 60;
const LIMITE_MENSAJES_MAX = 40;
// WhatsApp rechaza mensajes de más de 4096 caracteres.
const MAX_LARGO_MENSAJE_WHATSAPP = 4096;

// Datos reales de CLAUDE.md — el modelo nunca los inventa, siempre los
// recibe a través de la herramienta obtener_horario.
const HORARIO = 'Lunes a domingo, 4:00pm – 11:00pm';
const DIRECCION = 'Carrera 7 # 17B - 66, Riohacha, La Guajira';
const NOMBRE_NEGOCIO = 'Pizzería Horebs';
const URL_CATALOGO = 'https://pizzeriahorebs.shop/catalogo';

// Igual criterio que HORARIO/DIRECCION — dato real de CLAUDE.md, entregado
// solo a través de obtener_tamanos_pizza. Antes no existía en ningún lado
// del sistema, así que el modelo lo inventaba cuando le preguntaban.
const TAMANOS_PIZZA = 'Personal: 6 porciones. Mediana: 8 porciones. Grande: 12 porciones.';

// Tamaños y conectores no distinguen un producto de otro — se ignoran al
// comparar. "pizza personal hawaiana" tiene que matchear "Pizza Hawaiana"
// aunque la palabra de tamaño se meta en el medio.
const PALABRAS_IGNORADAS = new Set([
  'pizza',
  'de',
  'y',
  'la',
  'el',
  'con',
  'una',
  'un',
  'personal',
  'mediana',
  'grande',
]);

function palabrasSignificativas(texto: string): string[] {
  const normalizado = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return normalizado
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !PALABRAS_IGNORADAS.has(w));
}

const SYSTEM_INSTRUCTION = `Sos el asistente virtual de ${NOMBRE_NEGOCIO}, una pizzería en Riohacha, La Guajira, Colombia. Respondés por WhatsApp con un tono cercano, cálido y directo, como una persona real del equipo — no como un robot.

Reglas estrictas:
- Nunca inventes precios, productos, horarios, tamaños/porciones ni el estado de un pedido. Para cualquiera de esos datos, usá siempre la herramienta correspondiente y copiá el dato TAL CUAL te lo devuelve — nunca lo redondees, resumas ni cambies de memoria, aunque te "suene" distinto a lo que dijiste antes en la misma conversación.
- Si te preguntan cuántas porciones trae un tamaño (personal, mediana, grande), usá SIEMPRE obtener_tamanos_pizza — nunca respondas ese dato de memoria, es un error frecuente y grave.
- El costo de domicilio SIEMPRE es el que te devuelve calcular_pedido, literal — nunca digas "el domicilio es gratis" ni lo redondees a $0 salvo que la herramienta lo devuelva exactamente en $0. Es un error grave que ya pasó antes: perdés plata real de la pizzería si lo regalás por error.
- Si el cliente pide el menú, pregunta qué tienen, o pide opciones de una categoría (por ejemplo "qué pizzas tienen", "algo para tomar", "qué me recomendás"), usá mostrar_productos — manda hasta 3 tarjetas con foto, precio y un botón para agregar al pedido. NO listes productos ni precios vos en el mensaje, eso ya lo manda la herramienta.
- Si el cliente pide ver el catálogo COMPLETO (por ejemplo "mandame el link", "quiero ver todo el menú"), usá enviar_link_catalogo en vez de mostrar_productos.
- Si el cliente pregunta por un producto específico (por ejemplo "cuánto vale la pizza hawaiana", "tienen pizza margarita personal"), usá consultar_producto con el nombre de ese producto.
- Cuando el mensaje del cliente sea "Quiero pedir <nombre de producto>" (esto pasa cuando toca el botón "Agregar al pedido" de una tarjeta), tratalo como el inicio de un pedido de ese producto — seguí el flujo normal de toma de pedido de abajo, preguntando el tamaño si el producto tiene más de uno.
- Si el pedido del cliente es vago o genérico (por ejemplo "quiero más información", "contame más", "necesito ayuda") y no queda claro qué dato específico necesita, NO llames a ninguna herramienta todavía — preguntale primero si quiere ver el menú, el horario, el estado de su pedido, o hablar con alguien del equipo. Usá una herramienta recién cuando el cliente ya haya aclarado qué necesita.
- Si te preguntan algo que ninguna herramienta puede responder, o el cliente pide hablar con alguien del equipo, usá la herramienta derivar_a_humano.
- Mantené las respuestas breves — como un mensaje real de WhatsApp, no un párrafo largo.
- No prometas descuentos, promociones ni tiempos de entrega exactos que no te haya dado una herramienta.
- Para resaltar una palabra o un dato (un total, una dirección, un método de pago) usá UN SOLO asterisco de cada lado, como *esto* — WhatsApp no interpreta el doble asterisco de Markdown (**esto**) y lo muestra literal, con los asteriscos de más.

Cómo tomar un pedido (importante, seguí este orden):
1. Cuando el cliente quiera pedir algo, andá anotando los productos, tamaños y cantidades a medida que los va diciendo — podés ir preguntando de a uno si hace falta.
2. Preguntá si es para domicilio, para retirar, o para comer en el local. Si es domicilio, pedí la dirección.
3. Antes de calcular el total, pedile el nombre COMPLETO (nombre y apellido) de quien hace el pedido — es obligatorio, no lo saltees aunque ya venga charlando hace rato. Si solo da un nombre, preguntale el apellido también.
4. Cuando el cliente confirme que ya terminó de elegir todo y ya te dio su nombre completo, usá calcular_pedido con la lista completa de items, el nombre, el apellido, la modalidad (SOLO "domicilio", "retiro" o "local" — nunca metas la dirección ahí) y la dirección en el campo direccion si es domicilio — esa herramienta calcula el total real con los precios del catálogo, incluyendo el domicilio. NUNCA sumes los precios vos mismo ni inventes el costo del domicilio.
5. Copiá el resumen que te devuelve calcular_pedido PALABRA POR PALABRA en tu respuesta al cliente (cliente, productos, línea de domicilio con su costo, total) — no lo reescribas ni lo resumas con tus propias palabras, ni cambies ningún número. Después preguntale cuál va a ser su método de pago (efectivo, transferencia o tarjeta).
6. Apenas el cliente te diga el método de pago, usá derivar_a_humano para que una persona del equipo verifique y registre el pedido. Tu último mensaje antes de derivar tiene que decir que una persona del equipo va a confirmar el pedido en breve — NUNCA digas "tu pedido ya quedó registrado", "ya fue registrado" ni nada que suene a confirmado, porque todavía no lo está.
- El número de teléfono de contacto ya lo tenés (es el mismo WhatsApp desde el que te escribe) — no hace falta pedirlo aparte.`;

const HERRAMIENTAS = [
  {
    type: 'function',
    name: 'enviar_link_catalogo',
    description:
      'Manda el link del catálogo completo con fotos como botón de WhatsApp. Usar solo cuando el cliente pide ver el catálogo COMPLETO explícitamente (ej. "mandame el link", "quiero ver todo el menú") — para "qué tienen"/"qué pizzas hay" en general, usar mostrar_productos.',
    parameters: { type: 'object', properties: {} },
  },
  {
    type: 'function',
    name: 'mostrar_productos',
    description:
      'Manda hasta 3 tarjetas de producto (foto, precio y botón para agregar al pedido). Usar cuando el cliente pide el menú, pregunta qué tienen, pide opciones de una categoría, o pide una recomendación — nunca listes productos ni precios vos mismo en el mensaje.',
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
          items: {
            type: 'object',
            properties: {
              producto: {
                type: 'string',
                description: 'Nombre del producto, ej. "pizza hawaiana"',
              },
              tamano: {
                type: 'string',
                description:
                  'Tamaño elegido: personal, mediana o grande. Vacío si el producto no tiene tamaños (ej. bebidas).',
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
      required: ['items', 'nombre', 'apellido', 'modalidad'],
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
    name: 'obtener_tamanos_pizza',
    description:
      'Devuelve cuántas porciones trae cada tamaño de pizza (personal, mediana, grande). Usar siempre que pregunten por porciones o "para cuántos alcanza" — nunca responder ese dato de memoria.',
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

interface BusquedaProducto {
  encontrado?: Producto;
  error?: string;
}

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

      if (llamada.name === 'enviar_link_catalogo') {
        await this.metaGraph.enviarBotonCatalogo(
          canal,
          identificadorExterno,
          URL_CATALOGO,
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
        await this.enviarTarjetasProductos(
          canal,
          identificadorExterno,
          consulta,
        );
        await this.conversaciones.guardarInteraccionGemini(
          canal,
          identificadorExterno,
          respuesta.id,
        );
        return null;
      }

      if (llamada.name === 'derivar_a_humano') derivadoEnEsteTurno = true;

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
    return (
      salida?.content[0]?.text ??
      'Perdón, no pude procesar tu mensaje. Escribí *humano* para hablar con alguien del equipo.'
    );
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
          return await this.textoProducto(
            String(argumentos.nombre_producto ?? ''),
          );
        case 'calcular_pedido':
          return await this.textoCalcularPedido(argumentos);
        case 'obtener_horario':
          return `Horario: ${HORARIO}\nDirección: ${DIRECCION}`;
        case 'obtener_tamanos_pizza':
          return TAMANOS_PIZZA;
        case 'consultar_pedido':
          return await this.textoPedido(telefono);
        case 'derivar_a_humano':
          await this.conversaciones.derivarAHumano(canal, identificadorExterno);
          return 'Conversación derivada a una persona del equipo.';
        default:
          return 'Herramienta desconocida.';
      }
    } catch (err) {
      this.logger.error(
        `Error ejecutando herramienta ${nombre}: ${(err as Error).message}`,
      );
      return 'No se pudo obtener esta información en este momento.';
    }
  }

  private async buscarProductoUnico(
    nombreBuscado: string,
    productos: Producto[],
  ): Promise<BusquedaProducto> {
    const buscadas = palabrasSignificativas(nombreBuscado);
    if (buscadas.length === 0) {
      return {
        error: `No se pudo identificar el producto "${nombreBuscado}".`,
      };
    }
    const puntuados = productos
      .map((p) => ({
        producto: p,
        puntaje: palabrasSignificativas(p.nombre).filter((w) =>
          buscadas.includes(w),
        ).length,
      }))
      .filter((r) => r.puntaje > 0)
      .sort((a, b) => b.puntaje - a.puntaje);

    if (puntuados.length === 0) {
      return {
        error: `No se encontró ningún producto que coincida con "${nombreBuscado}" en el catálogo.`,
      };
    }
    const mejorPuntaje = puntuados[0].puntaje;
    const empatados = puntuados.filter((r) => r.puntaje === mejorPuntaje);
    if (empatados.length > 1) {
      const nombres = empatados.map((r) => r.producto.nombre).join(', ');
      return {
        error: `"${nombreBuscado}" es ambiguo — podría ser: ${nombres}. Hay que preguntarle al cliente cuál de esos quiere.`,
      };
    }
    return { encontrado: empatados[0].producto };
  }

  /**
   * Elige hasta 3 productos para mandar como tarjetas: si `consulta` matchea
   * palabras del nombre/descripción de algún producto, se ordenan por
   * puntaje; si no matchea nada o viene vacía, se usa el orden por
   * defecto de getProductos() (destacado primero — los productos ancla
   * confirmados en CLAUDE.md), tal cual ya usa el resto del catálogo.
   */
  private async enviarTarjetasProductos(
    canal: CanalMensajeria,
    identificadorExterno: string,
    consulta: string,
  ): Promise<void> {
    const productos = await this.catalog.getProductos();
    if (productos.length === 0) return;

    const buscadas = palabrasSignificativas(consulta);
    let elegidos = productos;
    if (buscadas.length > 0) {
      const puntuados = productos
        .map((p) => ({
          producto: p,
          puntaje: palabrasSignificativas(
            `${p.nombre} ${p.descripcion ?? ''}`,
          ).filter((w) => buscadas.includes(w)).length,
        }))
        .filter((r) => r.puntaje > 0)
        .sort((a, b) => b.puntaje - a.puntaje);
      if (puntuados.length > 0) {
        elegidos = puntuados.map((r) => r.producto);
      }
    }

    const tarjetas = elegidos.slice(0, 3).map((p) => ({
      nombre: p.nombre,
      descripcion: p.descripcion,
      imagenUrl: p.imagen_url,
      precioDesde: Math.min(
        ...p.variantes.map((v) => v.precio_oferta ?? v.precio),
      ),
    }));

    await this.metaGraph.enviarTarjetasProductos(
      canal,
      identificadorExterno,
      tarjetas,
    );
  }

  private async textoProducto(nombreBuscado: string): Promise<string> {
    const productos = await this.catalog.getProductos();
    const { encontrado, error } = await this.buscarProductoUnico(
      nombreBuscado,
      productos,
    );
    if (error)
      return `${error} Si no se puede resolver, ofrecé mandar el link completo con enviar_link_catalogo.`;
    const variantes = encontrado!.variantes
      .map(
        (v) =>
          `${v.nombre}: $${(v.precio_oferta ?? v.precio).toLocaleString('es-CO')}`,
      )
      .join(', ');
    return `${encontrado!.nombre}${encontrado!.descripcion ? ` — ${encontrado!.descripcion}` : ''}. Precios: ${variantes}`;
  }

  private async textoCalcularPedido(
    argumentos: Record<string, unknown>,
  ): Promise<string> {
    const items = Array.isArray(argumentos.items) ? argumentos.items : [];
    const nombre = String(argumentos.nombre ?? '').trim();
    const apellido = String(argumentos.apellido ?? '').trim();
    const modalidad = String(argumentos.modalidad ?? '').toLowerCase();
    const direccion = argumentos.direccion
      ? String(argumentos.direccion)
      : null;
    if (items.length === 0) {
      return 'No se recibió ningún producto para calcular. Pedile al cliente que confirme qué quiere ordenar.';
    }
    // Guardrail real, no solo la instrucción del prompt — si Gemini intenta
    // calcular sin nombre completo, esta herramienta se niega y lo manda a
    // preguntar, en vez de confiar en que el modelo siempre respete el
    // "required" del schema.
    if (!nombre || !apellido) {
      return 'Todavía falta el nombre completo (nombre y apellido) de quien hace el pedido — preguntáselo al cliente antes de calcular el total.';
    }

    const productos = await this.catalog.getProductos();
    const lineas: string[] = [];
    let subtotal = 0;

    for (const item of items as Record<string, unknown>[]) {
      const nombreProducto = String(item.producto ?? '');
      const cantidadCruda = Math.round(Number(item.cantidad ?? 1)) || 1;
      const cantidad = Math.min(Math.max(cantidadCruda, 1), 20);
      const tamanoBuscado = item.tamano ? String(item.tamano) : null;

      const { encontrado, error } = await this.buscarProductoUnico(
        nombreProducto,
        productos,
      );
      if (error) {
        return `No se pudo calcular el pedido: ${error}`;
      }

      let variante = encontrado!.variantes[0];
      if (encontrado!.variantes.length > 1) {
        const tamanoPalabras = palabrasSignificativas(tamanoBuscado ?? '');
        const match = encontrado!.variantes.find((v) =>
          palabrasSignificativas(v.nombre).some((w) =>
            tamanoPalabras.includes(w),
          ),
        );
        if (!match) {
          const opciones = encontrado!.variantes
            .map((v) => v.nombre)
            .join(', ');
          return `Para "${encontrado!.nombre}" falta saber el tamaño — opciones: ${opciones}. Preguntale al cliente cuál quiere.`;
        }
        variante = match;
      }

      const precio = variante.precio_oferta ?? variante.precio;
      const subtotalItem = precio * cantidad;
      subtotal += subtotalItem;
      lineas.push(
        `${cantidad}x ${encontrado!.nombre} (${variante.nombre}): $${subtotalItem.toLocaleString('es-CO')}`,
      );
    }

    const esDomicilio = modalidad === 'domicilio';
    const costoDomicilio = esDomicilio ? COSTO_DOMICILIO_DEFAULT : 0;
    const total = subtotal + costoDomicilio;

    return [
      'Resumen del pedido (copiá estos datos tal cual, no los cambies ni los redondees):',
      `Cliente: ${nombre} ${apellido}`,
      ...lineas,
      esDomicilio
        ? `Domicilio a ${direccion ?? 'dirección sin especificar'}: $${costoDomicilio.toLocaleString('es-CO')} (NO es gratis, cobrale este valor exacto)`
        : `Modalidad: ${modalidad || 'sin especificar'}`,
      `Total: $${total.toLocaleString('es-CO')}`,
    ].join('\n');
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
        throw new Error(`Gemini respondió ${res.status}: ${detalle}`);
      }
      return await res.json();
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new Error(`Gemini no respondió en ${TIMEOUT_GEMINI_MS / 1000}s`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}
