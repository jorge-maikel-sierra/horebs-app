import { Injectable } from '@nestjs/common';
import {
  CatalogService,
  entraEnCatalogoMeta,
} from '../catalog/catalog.service';
import { esAdicional } from './adicionales';
import { obtenerCapacidades } from './capacidades-canal';
import { textoDe } from './datos-pedido-bot';
import type { CanalMensajeria } from './conversaciones.tipos';
import { ConversacionesService } from './conversaciones.service';
import { ConversionesSocialService } from './conversiones-social.service';
import type { PasoFunctionCall } from './gemini-cliente.service';
import { NOMBRE_NEGOCIO, URL_CATALOGO } from './gemini-prompt';
import type { ContextoHerramienta } from './herramientas-bot.tipos';
import { MetaGraphService } from './meta-graph.service';
import {
  elegirProductos,
  seccionesPorCategoria,
  tarjetasDe,
} from './seleccion-productos';

/**
 * Las herramientas del modelo que mandan su propio mensaje a WhatsApp
 * (`enviar_catalogo` y `mostrar_productos`): el modelo no redacta nada de lo
 * que ve el cliente en estos casos.
 */
@Injectable()
export class EnvioHerramientasService {
  constructor(
    private readonly catalog: CatalogService,
    private readonly metaGraph: MetaGraphService,
    private readonly conversaciones: ConversacionesService,
    private readonly conversiones: ConversionesSocialService,
  ) {}

  /**
   * Registra lo enviado y guarda la interacción. Devuelve true si la
   * llamada era una de esas dos herramientas (no queda nada por responder).
   */
  async mandoElMensaje(
    llamada: PasoFunctionCall,
    ctx: ContextoHerramienta,
    interaccionId: string,
  ): Promise<boolean> {
    const { canal, identificadorExterno, conversacionId } = ctx;
    let registro: string | null;
    if (llamada.name === 'enviar_catalogo') {
      registro = await this.enviarMenu(canal, identificadorExterno);
    } else if (llamada.name === 'mostrar_productos') {
      const mostrados = await this.enviarProductos(
        canal,
        identificadorExterno,
        textoDe(llamada.arguments.consulta),
      );
      registro =
        mostrados.length > 0
          ? `Productos mostrados: ${mostrados.join(', ')}`
          : null;
    } else {
      return false;
    }
    if (registro) {
      await this.conversaciones.registrarMensaje(
        conversacionId,
        'saliente_bot',
        registro,
      );
    }
    await this.conversaciones.guardarInteraccionGemini(
      canal,
      identificadorExterno,
      interaccionId,
    );
    return true;
  }

  /** El menú: catálogo nativo en WhatsApp; tarjetas dentro del chat en Messenger e Instagram. */
  private async enviarMenu(
    canal: CanalMensajeria,
    identificadorExterno: string,
  ): Promise<string | null> {
    if (canal !== 'whatsapp') {
      return this.menuSocial(canal, identificadorExterno);
    }
    const enviado = await this.metaGraph.enviarCatalogo(
      canal,
      identificadorExterno,
      URL_CATALOGO,
      await this.retailerIdMiniatura(),
    );
    return enviado === 'catalogo'
      ? 'Menú enviado como catálogo de WhatsApp.'
      : `Mirá nuestro catálogo completo con fotos y precios acá: ${URL_CATALOGO}`;
  }

  /**
   * Messenger e Instagram no tienen el catálogo de WhatsApp y el cliente no
   * debe salir del chat: se manda un carrusel con los primeros productos y
   * después las categorías como opciones rápidas (al tocar una, el modelo
   * muestra los productos de esa categoría con `mostrar_productos`).
   */
  async menuSocial(
    canal: CanalMensajeria,
    identificadorExterno: string,
  ): Promise<string | null> {
    const [productos, categorias] = await Promise.all([
      this.catalog.getProductos(),
      this.catalog.getCategorias(),
    ]);
    const tarjetas = tarjetasDe(
      productos,
      obtenerCapacidades(canal).maxElementosTarjetas,
    );
    if (tarjetas.length === 0) return null;
    await this.metaGraph.enviarTarjetasProductos(
      canal,
      identificadorExterno,
      tarjetas,
    );
    this.conversiones.avisarConversacion(
      'ViewContent',
      canal,
      identificadorExterno,
    );
    this.conversiones.avisarConversacion(
      'ViewContent',
      canal,
      identificadorExterno,
    );
    const conProductos = categorias.filter((c) =>
      productos.some((p) => p.categoria_id === c.id && !esAdicional(p.nombre)),
    );
    if (conProductos.length > 1) {
      await this.metaGraph.enviarBotones(
        canal,
        identificadorExterno,
        '¿Quieres ver una categoría en particular? 👇',
        conProductos.map((c) => ({ id: `cat:${c.id}`, titulo: c.nombre })),
      );
    }
    return `Menú enviado dentro del chat: ${tarjetas.map((t) => t.nombre).join(', ')}.`;
  }

  /** Los productos de una categoría como tarjetas dentro del chat. null si no hay ninguno. */
  async categoriaSocial(
    canal: CanalMensajeria,
    identificadorExterno: string,
    categoriaId: string,
  ): Promise<string | null> {
    const productos = (await this.catalog.getProductos()).filter(
      (p) => p.categoria_id === categoriaId,
    );
    const tarjetas = tarjetasDe(
      productos,
      obtenerCapacidades(canal).maxElementosTarjetas,
    );
    if (tarjetas.length === 0) return null;
    await this.metaGraph.enviarTarjetasProductos(
      canal,
      identificadorExterno,
      tarjetas,
    );
    return `Productos mostrados: ${tarjetas.map((t) => t.nombre).join(', ')}`;
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

    const elegidos = elegirProductos(productos, categorias, consulta);
    const tarjetas =
      canal === 'whatsapp'
        ? tarjetasDe(elegidos)
        : tarjetasDe(elegidos, obtenerCapacidades(canal).maxElementosTarjetas);
    const secciones = seccionesPorCategoria(elegidos, categorias);

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
}
