import { Injectable } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import { esAdicional } from './adicionales';
import { buscarProductoUnico } from './busqueda-productos';
import { CheckoutEnviosService } from './checkout-envios.service';
import type { ContextoCheckout } from './checkout-whatsapp';
import { EnvioHerramientasService } from './envio-herramientas.service';
import { textoMasPedidas } from './mas-pedidas';
import { MasPedidasService } from './mas-pedidas.service';
import { BOTONES_INICIO, botonesMasPedidas } from './opciones-social';
import { textoTamanos } from './respuestas-fijas';
import { tamanoMencionado } from './tamanos-pizza';
import {
  botonesPrecioProducto,
  productoEnContexto,
  respuestaTamanoProducto,
  textoPrecioProducto,
} from './texto-producto';
import type { ProductoDto } from '../catalog/catalog.service';

/**
 * Lo que se le muestra al cliente de Messenger o Instagram antes de pedir: el
 * menú, una categoría y los precios. Todo sale del catálogo real; nada pasa
 * por el modelo.
 */
@Injectable()
export class VitrinaSocialService {
  constructor(
    private readonly catalog: CatalogService,
    private readonly masPedidas: MasPedidasService,
    private readonly envios: CheckoutEnviosService,
    private readonly menu: EnvioHerramientasService,
  ) {}

  /**
   * Precio de un producto si lo nombró; si no, las 3 pizzas más pedidas (en
   * producción, mandar la lista completa de 17 productos llegó cortada y no
   * ayudaba a decidir).
   */
  async precios(ctx: ContextoCheckout, texto: string): Promise<void> {
    const productos = await this.catalog.getProductos();
    const { encontrado } = buscarProductoUnico(texto, productos);
    if (encontrado && !esAdicional(encontrado.nombre)) {
      await this.mostrarProducto(ctx, encontrado);
      return;
    }
    await this.sugerirMasPedidas(ctx);
  }

  /**
   * En producción (nov 2026) el precio iba como una línea de texto y nadie
   * tocaba "Pedir esta": ahora va la foto, cada tamaño con sus porciones y el
   * tamaño como botón, que lo agrega al carrito de una.
   */
  private async mostrarProducto(
    ctx: ContextoCheckout,
    producto: ProductoDto,
  ): Promise<void> {
    const registro = await this.menu.tarjetasSocial(
      ctx.canal ?? 'messenger',
      ctx.identificadorExterno,
      [producto],
    );
    if (registro) await this.envios.registrar(ctx, registro);
    await this.envios.textoConOpciones(
      ctx,
      textoPrecioProducto(producto, new Date()),
      botonesPrecioProducto(producto),
    );
    this.envios.marcarInteres(ctx, producto.id);
  }

  /**
   * "¿Cuántas porciones trae la mediana?": si se viene hablando de una pizza,
   * se contesta sobre esa pizza y ese tamaño, con el botón para pedirla. Si
   * no hay una pizza clara, la tabla de tamaños de siempre.
   */
  async tamanos(ctx: ContextoCheckout, texto: string): Promise<void> {
    const productos = await this.catalog.getProductos();
    const nombrado = buscarProductoUnico(texto, productos).encontrado;
    const producto =
      nombrado && !esAdicional(nombrado.nombre)
        ? nombrado
        : productoEnContexto(
            await this.envios.ultimosMensajesBot(ctx),
            productos,
          );
    const medida = tamanoMencionado(texto);
    const especifica =
      producto && medida ? respuestaTamanoProducto(producto, medida) : null;
    if (producto && especifica) {
      await this.envios.textoConOpciones(
        ctx,
        especifica.texto,
        especifica.botones,
      );
      this.envios.marcarInteres(ctx, producto.id);
      return;
    }
    if (producto) {
      await this.envios.textoConOpciones(
        ctx,
        textoPrecioProducto(producto, new Date()),
        botonesPrecioProducto(producto),
      );
      this.envios.marcarInteres(ctx, producto.id);
      return;
    }
    await this.envios.textoConOpciones(ctx, textoTamanos(), BOTONES_INICIO);
  }

  /** El menú como tarjetas dentro del chat; con `paraPedir`, avisa dónde tocar. */
  async enviarMenu(ctx: ContextoCheckout, paraPedir: boolean): Promise<void> {
    const registro = await this.menu.menuSocial(
      ctx.canal ?? 'messenger',
      ctx.identificadorExterno,
    );
    if (!registro) {
      await this.envios.textoConOpciones(
        ctx,
        'Por ahora no puedo mostrarte el menú por aquí 😕 ¿Quieres hablar con una persona?',
        BOTONES_INICIO.slice(-1),
      );
      return;
    }
    await this.envios.registrar(ctx, registro);
    if (paraPedir) {
      await this.envios.texto(
        ctx,
        'Toca «Agregar al pedido» en el producto que quieras 👆',
      );
    }
  }

  /** Los productos de una categoría. false si no tiene ninguno. */
  async mostrarCategoria(
    ctx: ContextoCheckout,
    categoriaId: string,
  ): Promise<boolean> {
    const registro = await this.menu.categoriaSocial(
      ctx.canal ?? 'messenger',
      ctx.identificadorExterno,
      categoriaId,
    );
    if (!registro) return false;
    await this.envios.registrar(ctx, registro);
    return true;
  }

  private async sugerirMasPedidas(ctx: ContextoCheckout): Promise<void> {
    const pizzas = await this.masPedidas.pizzas();
    if (pizzas.length === 0) {
      await this.enviarMenu(ctx, false);
      return;
    }
    const registro = await this.menu.tarjetasSocial(
      ctx.canal ?? 'messenger',
      ctx.identificadorExterno,
      pizzas,
    );
    if (registro) await this.envios.registrar(ctx, registro);
    await this.envios.textoConOpciones(
      ctx,
      textoMasPedidas(pizzas),
      botonesMasPedidas(pizzas),
    );
    this.envios.marcarInteres(ctx, pizzas[0].id);
  }
}
