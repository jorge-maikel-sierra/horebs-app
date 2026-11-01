import { Injectable, Logger } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import { buscarProductoUnico, elegirVariante } from './busqueda-productos';
import {
  cantidadDe,
  itemsEscritosDe,
  textoDe,
  validarDatosCliente,
  type DatosClientePedido,
} from './datos-pedido-bot';
import { SIN_TOTAL_INVENTADO } from './gemini-prompt';
import {
  ConversacionesService,
  type CanalMensajeria,
  type ItemCarritoPendiente,
} from './conversaciones.service';
import {
  armarMitadYMitad,
  esPizzaPorCategoria,
  pedidoMitadDeItem,
  type MitadYMitad,
} from './pizza-mitad';
import type { LineaPedido } from './resumen-pedido';
import type { Producto } from './seleccion-productos';

export type ResultadoCalculo =
  | {
      ok: true;
      items: ItemCarritoPendiente[];
      lineas: LineaPedido[];
      datos: DatosClientePedido & {
        /** Qué lleva cada pizza mitad y mitad; queda escrito en el pedido. */
        nota?: string;
      };
    }
  | { ok: false; texto: string };

const MAX_LOG_TEXTO = 160;

/** Lo que se va juntando mientras se recorren los productos pedidos. */
interface Acumulado {
  lineas: LineaPedido[];
  items: ItemCarritoPendiente[];
  notas: string[];
}

/**
 * Total real del pedido. Los productos del carrito del catálogo salen por
 * id exacto de variante (guardado al recibir el carrito), sin que el modelo
 * los vuelva a nombrar; solo lo pedido aparte por escrito pasa por la
 * búsqueda por nombre. Si algo falla, devuelve el texto para el modelo —
 * nunca un total.
 */
@Injectable()
export class CalculoPedidoBotService {
  private readonly logger = new Logger(CalculoPedidoBotService.name);

  constructor(
    private readonly catalog: CatalogService,
    private readonly conversaciones: ConversacionesService,
  ) {}

  async mitadYMitadDe(
    pedido: Parameters<typeof armarMitadYMitad>[0],
  ): Promise<MitadYMitad> {
    const [productos, categorias] = await Promise.all([
      this.catalog.getProductos(),
      this.catalog.getCategorias(),
    ]);
    return armarMitadYMitad(pedido, productos, esPizzaPorCategoria(categorias));
  }

  async calcular(
    argumentos: Record<string, unknown>,
    canal: CanalMensajeria,
    identificadorExterno: string,
  ): Promise<ResultadoCalculo> {
    const escritos = itemsEscritosDe(argumentos);
    const fallo = (texto: string): ResultadoCalculo => {
      // Producto y tamaño pedidos, nunca datos del cliente.
      this.logger.warn(
        `id=${identificadorExterno} calcular_pedido falló — items=${JSON.stringify(escritos.map((i) => [i.producto, i.tamano, i.cantidad]))} → ${texto.slice(0, MAX_LOG_TEXTO)}`,
      );
      return { ok: false, texto };
    };

    const validacion = validarDatosCliente(argumentos);
    if (!validacion.ok) return fallo(validacion.texto);

    const acumulado = await this.lineasDelCarrito(canal, identificadorExterno);
    const productos =
      escritos.length > 0 ? await this.catalog.getProductos() : [];
    for (const item of escritos) {
      const error = await this.agregarItemEscrito(item, productos, acumulado);
      if (error) return fallo(error);
    }

    if (acumulado.lineas.length === 0) {
      return fallo(
        `No hay productos para calcular: el cliente no mandó un carrito del catálogo ni pidió productos por escrito. Preguntale qué quiere pedir. ${SIN_TOTAL_INVENTADO}`,
      );
    }
    const { notas } = acumulado;
    return {
      ok: true,
      items: acumulado.items,
      lineas: acumulado.lineas,
      datos: {
        ...validacion.datos,
        ...(notas.length > 0 ? { nota: notas.join(' ') } : {}),
      },
    };
  }

  /** Líneas e ids exactos del carrito del catálogo que el cliente ya mandó. */
  private async lineasDelCarrito(
    canal: CanalMensajeria,
    identificadorExterno: string,
  ): Promise<Acumulado> {
    const carrito = await this.conversaciones.obtenerCarrito(
      canal,
      identificadorExterno,
    );
    const { disponibles } = await this.catalog.resolverCarrito(carrito);
    return {
      lineas: disponibles.map((i) => ({
        cantidad: i.cantidad,
        productoNombre: i.productoNombre,
        varianteNombre: i.conTamanos ? i.varianteNombre : null,
        precioUnitario: i.precio,
      })),
      // Ids exactos de todo lo que entra al pedido: el checkout con botones
      // crea el pedido con estos, sin volver a buscar por nombre.
      items: disponibles.map((i) => ({
        varianteId: i.varianteId,
        cantidad: i.cantidad,
      })),
      notas: [],
    };
  }

  /** Suma al acumulado un producto pedido por escrito; devuelve el motivo si no se pudo. */
  private async agregarItemEscrito(
    item: Record<string, unknown>,
    productos: Producto[],
    acumulado: Acumulado,
  ): Promise<string | null> {
    const cantidad = cantidadDe(item);
    if (item.segundo_sabor) {
      return this.agregarMitadYMitad(item, cantidad, acumulado);
    }

    const {
      encontrado,
      variante: varianteNombrada,
      error,
    } = buscarProductoUnico(textoDe(item.producto), productos);
    if (error) {
      return `No se pudo calcular el pedido: ${error} ${SIN_TOTAL_INVENTADO}`;
    }
    const variante =
      varianteNombrada ??
      elegirVariante(encontrado!, textoDe(item.tamano) || null);
    if (!variante) {
      const opciones = encontrado!.variantes.map((v) => v.nombre).join(', ');
      return `Para "${encontrado!.nombre}" falta saber cuál — opciones exactas: ${opciones}. Preguntale al cliente cuál quiere, ofreciendo solo esas opciones. ${SIN_TOTAL_INVENTADO}`;
    }
    acumulado.lineas.push({
      cantidad,
      productoNombre: encontrado!.nombre,
      varianteNombre: encontrado!.variantes.length > 1 ? variante.nombre : null,
      precioUnitario: variante.precio_oferta ?? variante.precio,
    });
    acumulado.items.push({ varianteId: variante.id, cantidad });
    return null;
  }

  private async agregarMitadYMitad(
    item: Record<string, unknown>,
    cantidad: number,
    acumulado: Acumulado,
  ): Promise<string | null> {
    const mitad = await this.mitadYMitadDe(pedidoMitadDeItem(item));
    if (!mitad.ok) {
      return `No se pudo calcular el pedido: ${mitad.error} ${SIN_TOTAL_INVENTADO}`;
    }
    acumulado.lineas.push({
      cantidad,
      productoNombre: 'Pizza mitad y mitad',
      varianteNombre: mitad.variante.nombre,
      precioUnitario: mitad.precio,
    });
    acumulado.items.push({ varianteId: mitad.variante.id, cantidad });
    acumulado.notas.push(
      cantidad > 1 ? `${cantidad} pizzas: ${mitad.nota}` : mitad.nota,
    );
    return null;
  }
}
