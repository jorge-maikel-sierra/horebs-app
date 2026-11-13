import { Injectable } from '@nestjs/common';
import { CatalogService, type ProductoDto } from '../catalog/catalog.service';
import { esAdicional } from './adicionales';
import { buscarProductoUnico } from './busqueda-productos';
import { CheckoutEnviosService } from './checkout-envios.service';
import { listaItems, type ContextoCheckout } from './checkout-whatsapp';
import { CheckoutWhatsappService } from './checkout-whatsapp.service';
import { OrigenConversacionService } from './origen-conversacion.service';
import {
  BOTON_SOCIAL,
  BOTONES_ARMAR_PEDIDO,
  BOTONES_INICIO,
  PREFIJO_CANTIDAD_SOCIAL,
  PREFIJO_PRODUCTO_SOCIAL,
  PREFIJO_VARIANTE_SOCIAL,
  botonesDeCantidad,
  botonesDeTamano,
  leerCantidad,
  sumarItem,
} from './opciones-social';

/**
 * El pedido de Messenger e Instagram por botones: producto → tamaño →
 * cantidad → "¿algo más?" y de ahí al checkout de siempre (modalidad,
 * dirección, nombre, teléfono, hora y pago). Nada de esto pasa por el modelo,
 * así que el cliente ve siempre las mismas opciones y los precios reales.
 */
@Injectable()
export class PedidoSocialService {
  constructor(
    private readonly catalog: CatalogService,
    private readonly origenes: OrigenConversacionService,
    private readonly checkout: CheckoutWhatsappService,
    private readonly envios: CheckoutEnviosService,
  ) {}

  /** "Quiero pedir <producto>": arranca el pedido. false si no es un producto del menú. */
  async iniciarProducto(
    ctx: ContextoCheckout,
    nombre: string,
  ): Promise<boolean> {
    const productos = await this.catalog.getProductos();
    const producto =
      productos.find((p) => p.nombre === nombre) ??
      buscarProductoUnico(nombre, productos).encontrado;
    if (!producto || esAdicional(producto.nombre)) return false;
    await this.preguntarTamano(ctx, producto);
    return true;
  }

  /** Los ids ped:p / ped:v / ped:q / ped:fin / ped:vaciar / ped:repetir. false si el id no es de acá. */
  async atenderBoton(ctx: ContextoCheckout, id: string): Promise<boolean> {
    if (id.startsWith(PREFIJO_PRODUCTO_SOCIAL)) {
      return this.productoPorId(ctx, id.slice(PREFIJO_PRODUCTO_SOCIAL.length));
    }
    if (id.startsWith(PREFIJO_VARIANTE_SOCIAL)) {
      return this.preguntarCantidad(
        ctx,
        id.slice(PREFIJO_VARIANTE_SOCIAL.length),
      );
    }
    if (id.startsWith(PREFIJO_CANTIDAD_SOCIAL)) {
      return this.agregar(ctx, id.slice(PREFIJO_CANTIDAD_SOCIAL.length));
    }
    if (id === BOTON_SOCIAL.fin) return this.seguirConElPedido(ctx);
    if (id === BOTON_SOCIAL.vaciar) return this.vaciar(ctx);
    if (id === BOTON_SOCIAL.repetir) return this.repetir(ctx);
    return false;
  }

  private async productoPorId(
    ctx: ContextoCheckout,
    id: string,
  ): Promise<boolean> {
    const productos = await this.catalog.getProductos();
    const producto = productos.find((p) => p.id === id);
    if (!producto) return false;
    await this.preguntarTamano(ctx, producto);
    return true;
  }

  private async preguntarTamano(
    ctx: ContextoCheckout,
    producto: ProductoDto,
  ): Promise<void> {
    if (producto.variantes.length === 1) {
      await this.preguntarCantidad(ctx, producto.variantes[0].id);
      return;
    }
    await this.envios.botones(
      ctx,
      `¿De qué tamaño quieres la ${producto.nombre}? 🍕`,
      botonesDeTamano(producto),
    );
  }

  private async preguntarCantidad(
    ctx: ContextoCheckout,
    varianteId: string,
  ): Promise<boolean> {
    const hallado = await this.buscarVariante(varianteId);
    if (!hallado) return false;
    const { producto, variante } = hallado;
    const detalle =
      producto.variantes.length > 1 ? ` (${variante.nombre})` : '';
    await this.envios.botones(
      ctx,
      `¿Cuántas ${producto.nombre}${detalle} quieres?`,
      botonesDeCantidad(varianteId),
    );
    return true;
  }

  private async agregar(
    ctx: ContextoCheckout,
    resto: string,
  ): Promise<boolean> {
    const lectura = leerCantidad(resto);
    if (!lectura || !(await this.buscarVariante(lectura.varianteId))) {
      return false;
    }
    const actual = await this.envios.obtenerCarrito(ctx);
    const carrito = sumarItem(actual, lectura.varianteId, lectura.cantidad);
    await this.envios.guardarCarrito(ctx, carrito);
    const { disponibles } = await this.catalog.resolverCarrito(carrito);
    await this.envios.botones(
      ctx,
      `¡Anotado! ✅\n${listaItems(disponibles)}\n\n¿Quieres agregar algo más?`,
      BOTONES_ARMAR_PEDIDO,
    );
    return true;
  }

  private async seguirConElPedido(ctx: ContextoCheckout): Promise<boolean> {
    const carrito = await this.envios.obtenerCarrito(ctx);
    if (carrito.length === 0) {
      await this.envios.textoConOpciones(
        ctx,
        'Todavía no tienes nada en tu pedido 🍕 ¿Qué quieres hacer?',
        BOTONES_INICIO,
      );
      return true;
    }
    const { disponibles, noDisponibles } =
      await this.catalog.resolverCarrito(carrito);
    await this.checkout.iniciar(ctx, disponibles, noDisponibles, null);
    return true;
  }

  private async vaciar(ctx: ContextoCheckout): Promise<boolean> {
    await this.envios.guardarCarrito(ctx, null);
    await this.envios.textoConOpciones(
      ctx,
      'Listo, vacié tu pedido. ¿Qué quieres hacer?',
      BOTONES_INICIO,
    );
    return true;
  }

  private async buscarVariante(varianteId: string): Promise<{
    producto: ProductoDto;
    variante: ProductoDto['variantes'][number];
  } | null> {
    const productos = await this.catalog.getProductos();
    for (const producto of productos) {
      const variante = producto.variantes.find((v) => v.id === varianteId);
      if (variante) return { producto, variante };
    }
    return null;
  }

  /**
   * "Repetir pedido": arma el carrito con lo del último pedido que salió de
   * esta conversación (con los precios de hoy) y sigue al checkout de siempre.
   */
  private async repetir(ctx: ContextoCheckout): Promise<boolean> {
    const items = await this.origenes.itemsDelUltimoPedido(ctx.conversacionId);
    if (items.length === 0) {
      await this.envios.textoConOpciones(
        ctx,
        'Todavía no tienes pedidos con nosotros por este chat 🍕 ¿Qué quieres hacer?',
        BOTONES_INICIO,
      );
      return true;
    }
    const { disponibles, noDisponibles } =
      await this.catalog.resolverCarrito(items);
    await this.checkout.iniciar(ctx, disponibles, noDisponibles, null);
    return true;
  }
}
