import { Injectable } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import { PedidosService } from '../pedidos/pedidos.service';
import { ConversacionesService, type CanalMensajeria } from './conversaciones.service';

// Datos reales de CLAUDE.md — no se inventan ni se duplican como constantes
// de negocio en otro lado, solo se usan acá porque apps/api no comparte
// runtime con apps/web (son dos despliegues separados).
const HORARIO = 'Lunes a domingo, 4:00pm – 11:00pm';
const DIRECCION = 'Carrera 7 # 17B - 66, Riohacha, La Guajira';
const NOMBRE_NEGOCIO = 'Pizzería Horebs';
const URL_CATALOGO = 'https://pizzeriahorebs.shop/catalogo';

type Intencion = 'saludo' | 'menu' | 'horario' | 'pedido' | 'humano' | 'desconocida';

function detectarIntencion(texto: string): Intencion {
  const t = texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // quita tildes para matchear "menu"/"menú"

  if (/\b(humano|agente|persona|asesor|alguien)\b/.test(t)) return 'humano';
  if (/\b(pedido|orden|donde esta|estado)\b/.test(t)) return 'pedido';
  if (/\b(menu|carta|precio|productos|que tienen|pizzas)\b/.test(t)) return 'menu';
  if (/\b(horario|hora|abierto|abren|cierran)\b/.test(t)) return 'horario';
  if (/\b(hola|buenas|buenos dias|buenas tardes|buenas noches|hi|hello)\b/.test(t)) {
    return 'saludo';
  }
  return 'desconocida';
}

function formatPrecio(precio: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(precio);
}

const MENSAJE_BIENVENIDA = `¡Hola! 👋 Soy el asistente de ${NOMBRE_NEGOCIO}.

Puedo ayudarte con:
🍕 *menú* — ver los productos y precios
🕓 *horario* — cuándo atendemos
📦 *pedido* — el estado de tu último pedido
🙋 *humano* — hablar con alguien del equipo

Escribime cuál te sirve.`;

const MENSAJE_NO_ENTENDIDO = `No estoy seguro de haber entendido 🤔. Puedo ayudarte con *menú*, *horario*, el estado de tu *pedido*, o escribí *humano* para hablar con alguien del equipo.`;

/**
 * Detección de intención por palabras clave — MVP explícitamente pedido
 * como "flujo conversacional básico", no NLU/LLM. Subir a un modelo de
 * lenguaje es una extensión clara y separada si se pide más adelante.
 */
@Injectable()
export class BotFlowService {
  constructor(
    private readonly catalog: CatalogService,
    private readonly pedidos: PedidosService,
    private readonly conversaciones: ConversacionesService,
  ) {}

  async responder(
    canal: CanalMensajeria,
    identificadorExterno: string,
    telefono: string | null,
    textoEntrante: string,
  ): Promise<string> {
    const intencion = detectarIntencion(textoEntrante);

    switch (intencion) {
      case 'saludo':
        return MENSAJE_BIENVENIDA;
      case 'menu':
        return this.responderMenu();
      case 'horario':
        return `Atendemos ${HORARIO}.\n📍 ${DIRECCION}`;
      case 'pedido':
        return this.responderPedido(telefono);
      case 'humano':
        await this.conversaciones.derivarAHumano(canal, identificadorExterno);
        return 'Te conecto con alguien del equipo — en un momento te responden por acá mismo. 🙋';
      default:
        return MENSAJE_NO_ENTENDIDO;
    }
  }

  private async responderMenu(): Promise<string> {
    const productos = await this.catalog.getProductos();
    if (productos.length === 0) {
      return `Todavía no tengo el menú cargado — mirá el catálogo completo acá: ${URL_CATALOGO}`;
    }

    const lineas = productos.slice(0, 12).map((p) => {
      const precios = p.variantes.map((v) => v.precio_oferta ?? v.precio);
      const desde = precios.length > 0 ? Math.min(...precios) : null;
      return desde !== null
        ? `🍕 ${p.nombre} — desde ${formatPrecio(desde)}`
        : `🍕 ${p.nombre}`;
    });

    return [
      '*Nuestro menú:*',
      ...lineas,
      '',
      `Catálogo completo con fotos: ${URL_CATALOGO}`,
    ].join('\n');
  }

  private async responderPedido(telefono: string | null): Promise<string> {
    if (!telefono) {
      return `No pude identificar tu número. Escribinos por WhatsApp al mismo chat donde hiciste el pedido, o revisá el estado en ${URL_CATALOGO.replace('/catalogo', '/cuenta')}.`;
    }

    const pedidos = await this.pedidos.buscarPorTelefono(telefono);
    if (pedidos.length === 0) {
      return 'No encontré pedidos asociados a este número. Si acabás de pedir, puede tardar unos segundos en aparecer — si el problema sigue, escribí *humano*.';
    }

    const ultimo = pedidos[0];
    const items = ultimo.items
      .map((i) => `${i.cantidad}× ${i.producto_nombre}${i.variante_nombre ? ` (${i.variante_nombre})` : ''}`)
      .join(', ');

    return [
      `Tu último pedido está: *${ultimo.estado}*`,
      items,
      `Total: ${formatPrecio(ultimo.total)}`,
    ].join('\n');
  }
}
