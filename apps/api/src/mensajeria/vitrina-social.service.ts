import { Injectable } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import { esAdicional } from './adicionales';
import { buscarProductoUnico } from './busqueda-productos';
import { CheckoutEnviosService } from './checkout-envios.service';
import type { ContextoCheckout } from './checkout-whatsapp';
import { EnvioHerramientasService } from './envio-herramientas.service';
import { textoMasPedidas } from './mas-pedidas';
import { MasPedidasService } from './mas-pedidas.service';
import {
  BOTONES_INICIO,
  BOTONES_TRAS_PRECIO,
  PREFIJO_PRODUCTO_SOCIAL,
  botonesMasPedidas,
  lineaDePrecios,
} from './opciones-social';

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
      await this.envios.textoConOpciones(ctx, lineaDePrecios(encontrado), [
        {
          id: `${PREFIJO_PRODUCTO_SOCIAL}${encontrado.id}`,
          titulo: '🛒 Pedir esta',
        },
        ...BOTONES_TRAS_PRECIO,
      ]);
      return;
    }
    await this.sugerirMasPedidas(ctx);
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
  }
}
