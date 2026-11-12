import { Injectable } from '@nestjs/common';
import { CatalogService, type ProductoDto } from '../catalog/catalog.service';
import { esAdicional } from './adicionales';
import { buscarProductoUnico } from './busqueda-productos';
import { CheckoutEnviosService } from './checkout-envios.service';
import { listaItems, type ContextoCheckout } from './checkout-whatsapp';
import { CheckoutWhatsappService } from './checkout-whatsapp.service';
import { ConversacionesService } from './conversaciones.service';
import {
  BOTON_SOCIAL,
  BOTONES_ARMAR_PEDIDO,
  BOTONES_INICIO,
  BOTONES_TRAS_PRECIO,
  PREFIJO_CANTIDAD_SOCIAL,
  PREFIJO_PRODUCTO_SOCIAL,
  PREFIJO_VARIANTE_SOCIAL,
  botonesDeCantidad,
  botonesDeTamano,
  leerCantidad,
  lineaDePrecios,
  listaDePrecios,
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
    private readonly conversaciones: ConversacionesService,
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

  /** Los ids ped:p / ped:v / ped:q / ped:fin / ped:vaciar. false si el id no es de acá. */
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
    return false;
  }

  /** Precio de un producto (si lo nombró) o la lista completa de precios. */
  async responderPrecios(ctx: ContextoCheckout, texto: string): Promise<void> {
    const productos = await this.catalog.getProductos();
    const { encontrado } = buscarProductoUnico(texto, productos);
    if (encontrado && !esAdicional(encontrado.nombre)) {
      await this.envios.textoConOpciones(ctx, lineaDePrecios(encontrado), [
        {
          id: `${PREFIJO_PRODUCTO_SOCIAL}${encontrado.id}`,
          titulo: '🛒 Pedir esta',
        },
        ...BOTONES_TRAS_PRECIO,
      ]);
      return;
    }
    await this.envios.textoConOpciones(
      ctx,
      listaDePrecios(productos),
      BOTONES_INICIO,
    );
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
    const canal = ctx.canal ?? 'messenger';
    const actual = await this.conversaciones.obtenerCarrito(
      canal,
      ctx.identificadorExterno,
    );
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
    const carrito = await this.conversaciones.obtenerCarrito(
      ctx.canal ?? 'messenger',
      ctx.identificadorExterno,
    );
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
    await this.conversaciones.guardarCarrito(
      ctx.canal ?? 'messenger',
      ctx.identificadorExterno,
      null,
    );
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
}
