import { Injectable, Logger } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import { COSTO_DOMICILIO_DEFAULT } from '../common/costos';
import { estadoAtencion } from '../common/horario';
import { PedidosConsultasService } from '../pedidos/pedidos-consultas.service';
import { buscarProductoUnico } from './busqueda-productos';
import { CalculoPedidoBotService } from './calculo-pedido-bot.service';
import { textoDe } from './datos-pedido-bot';
import { DerivacionBotService } from './derivacion-bot.service';
import type { ContextoHerramienta } from './herramientas-bot.tipos';
import {
  DIRECCION,
  ESTADO_ATENCION_TEXTO,
  HERRAMIENTAS,
  HORARIO,
  HORARIO_PEDIDOS_BOT,
  SIN_TOTAL_INVENTADO,
  TAMANOS_PIZZA,
} from './gemini-prompt';
import { pedidoMitadDeHerramienta } from './pizza-mitad';
import { textoDetalleProducto } from './seleccion-productos';

const SIN_TELEFONO =
  'No se pudo identificar el número de teléfono del cliente en este canal.';

/**
 * Las herramientas de consulta y de derivación que el modelo puede llamar.
 * Cada una devuelve texto para el modelo; el dato real sale siempre de
 * Supabase vía los servicios del sistema, nunca de lo que el modelo suponga.
 */
@Injectable()
export class HerramientasBotService {
  private readonly logger = new Logger(HerramientasBotService.name);

  constructor(
    private readonly catalog: CatalogService,
    private readonly pedidos: PedidosConsultasService,
    private readonly derivacion: DerivacionBotService,
    private readonly calculo: CalculoPedidoBotService,
  ) {}

  async ejecutar(
    nombre: string,
    argumentos: Record<string, unknown>,
    ctx: ContextoHerramienta,
  ): Promise<string> {
    try {
      return await this.despachar(nombre, argumentos, ctx);
    } catch (err) {
      this.logger.error(
        `Error ejecutando herramienta ${nombre}: ${(err as Error).message}`,
      );
      return 'No se pudo obtener esta información en este momento.';
    }
  }

  private async despachar(
    nombre: string,
    argumentos: Record<string, unknown>,
    ctx: ContextoHerramienta,
  ): Promise<string> {
    switch (nombre) {
      case 'consultar_producto':
        return this.textoProducto(textoDe(argumentos.nombre_producto));
      case 'cotizar_pizza_mitad_y_mitad':
        return this.textoMitadYMitad(argumentos);
      case 'obtener_horario':
        return this.textoHorario();
      case 'obtener_categorias':
        return this.textoCategorias();
      case 'obtener_tamanos_pizza':
        return TAMANOS_PIZZA;
      case 'consultar_pedido':
        return this.textoPedido(ctx.telefono);
      case 'obtener_cliente_registrado':
        return this.textoClienteRegistrado(ctx.telefono);
      case 'derivar_a_humano':
        return this.derivacion.derivar(ctx);
      default:
        // En producción el modelo pidió herramientas que no existen
        // (obtener_sabores_pizza, obtener_menu_completo): se le devuelve
        // la lista real para que se corrija en la vuelta siguiente.
        return `La herramienta "${nombre}" no existe. Las únicas disponibles son: ${HERRAMIENTAS.map((h) => h.name).join(', ')}.`;
    }
  }

  private async textoMitadYMitad(
    argumentos: Record<string, unknown>,
  ): Promise<string> {
    const mitad = await this.calculo.mitadYMitadDe(
      pedidoMitadDeHerramienta(argumentos),
    );
    return mitad.ok ? mitad.texto : `${mitad.error} ${SIN_TOTAL_INVENTADO}`;
  }

  private textoHorario(): string {
    return [
      `Horario del local: ${HORARIO}`,
      HORARIO_PEDIDOS_BOT,
      `Ahora mismo: ${ESTADO_ATENCION_TEXTO[estadoAtencion(new Date())]}`,
      `Dirección: ${DIRECCION}`,
      `Costo de domicilio: $${COSTO_DOMICILIO_DEFAULT.toLocaleString('es-CO')}`,
    ].join('\n');
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
    if (error) {
      return `${error} Si no se puede resolver, ofrecé mandarle el menú completo con enviar_catalogo.`;
    }
    return textoDetalleProducto(encontrado!);
  }

  private async textoPedido(telefono: string | null): Promise<string> {
    if (!telefono) return SIN_TELEFONO;
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

  private async textoClienteRegistrado(
    telefono: string | null,
  ): Promise<string> {
    if (!telefono) return SIN_TELEFONO;
    const nombre = await this.pedidos.buscarNombrePorTelefono(telefono);
    return nombre
      ? `Cliente encontrado: ${nombre}.`
      : 'No se encontró ningún cliente registrado con este número de teléfono.';
  }
}
