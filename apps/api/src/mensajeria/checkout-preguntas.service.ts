import { Injectable } from '@nestjs/common';
import {
  CatalogService,
  type ItemCarritoResuelto,
} from '../catalog/catalog.service';
import { COSTO_DOMICILIO_DEFAULT } from '../common/costos';
import { estadoAtencion, franjasEntrega } from '../common/horario';
import { PedidosConsultasService } from '../pedidos/pedidos-consultas.service';
import { CheckoutEnviosService } from './checkout-envios.service';
import {
  adicionalesDeCatalogo,
  adicionalMencionado,
  nombreCortoAdicional,
  pizzasDelCarrito,
  respuestaEsNo,
  respuestaEsSi,
  sumarAlCarrito,
  varianteParaTamano,
} from './adicionales';
import {
  BOTON,
  BOTONES_PAGO,
  lineasDeCarrito,
  MENSAJE_CERRADO,
  PREFIJO_ADICIONAL_PIZZA,
  PREFIJO_ADICIONAL_PRODUCTO,
  PREFIJO_HORA,
  textoEntrega,
  type ContextoCheckout,
  type EntradaCheckout,
} from './checkout-whatsapp';
import {
  ConversacionesService,
  type CheckoutWhatsapp,
} from './conversaciones.service';
import { armarResumenPedido, pesos } from './resumen-pedido';

export const TEXTO_PEDIR_DIRECCION =
  '¿A dónde te lo llevamos? Escribime la dirección completa: calle o carrera, barrio y una referencia (por ejemplo, "frente a la tienda X").';

/**
 * Las preguntas del checkout con botones: hora de entrega, dirección escrita
 * y resumen con los botones de pago. Cada una deja guardado el
 * paso en que quedó el cliente.
 */
const MAX_FILAS_PIZZAS = 10;

const BOTONES_SEGUIR_ADICIONALES = [
  { id: BOTON.adicionalesSi, titulo: 'Otro adicional' },
  { id: BOTON.adicionalesNo, titulo: 'Listo, seguir' },
];

@Injectable()
export class CheckoutPreguntasService {
  constructor(
    private readonly conversaciones: ConversacionesService,
    private readonly catalog: CatalogService,
    private readonly consultas: PedidosConsultasService,
    private readonly envios: CheckoutEnviosService,
  ) {}

  /**
   * Lista de franjas: "Lo antes posible" con el local abierto, y reservas
   * cada 30 min desde las 4:00 p.m. Fuera del horario del bot, cierra.
   */
  async hora(ctx: ContextoCheckout, checkout: CheckoutWhatsapp): Promise<void> {
    const ahora = new Date();
    const franjas = franjasEntrega(ahora);
    if (franjas.length === 0) {
      await this.envios.limpiar(ctx);
      await this.envios.texto(ctx, MENSAJE_CERRADO);
      return;
    }
    checkout.paso = 'hora';
    checkout.entrega = undefined;
    await this.envios.guardar(ctx, checkout);
    const cuerpo =
      estadoAtencion(ahora) === 'reservas'
        ? 'Abrimos a las 4:00 p.m. 🕓 ¿Para qué hora te lo reservamos?'
        : '¿Para cuándo lo querés?';
    await this.envios.lista(
      ctx,
      cuerpo,
      'Elegir hora',
      franjas.map((f) => ({ id: `${PREFIJO_HORA}${f.id}`, titulo: f.titulo })),
    );
  }

  /** Ofrece la dirección del último pedido; si no hay, pide que la escriba. */
  async direccion(
    ctx: ContextoCheckout,
    checkout: CheckoutWhatsapp,
  ): Promise<void> {
    const [ultimo, cliente] = await Promise.all([
      this.consultas.ultimoPedidoPorTelefono(ctx.identificadorExterno),
      this.consultas.clientePorTelefono(ctx.identificadorExterno),
    ]);
    const sugerida =
      (ultimo?.direccionEntrega ?? cliente?.direccion)?.trim() || null;
    if (!sugerida) {
      await this.pedirDireccion(ctx, checkout);
      return;
    }
    checkout.paso = 'direccion';
    checkout.direccionSugerida = sugerida;
    await this.envios.guardar(ctx, checkout);
    await this.envios.botones(ctx, `¿Te lo llevamos a *${sugerida}*?`, [
      { id: BOTON.direccionAnterior, titulo: 'Sí, ahí' },
      { id: BOTON.otraDireccion, titulo: 'Otra dirección' },
    ]);
  }

  /**
   * Solo dirección escrita: el pin de WhatsApp es el GPS del teléfono y puede
   * quedar a varias cuadras de la casa (decisión del dueño, 2 nov 2026).
   */
  async pedirDireccion(
    ctx: ContextoCheckout,
    checkout: CheckoutWhatsapp,
  ): Promise<void> {
    checkout.paso = 'direccion';
    await this.envios.guardar(ctx, checkout);
    await this.envios.texto(ctx, TEXTO_PEDIR_DIRECCION);
  }

  /** Lo que el cliente ya tiene en el carrito, con precios y nombres de la base. */
  private async carritoResuelto(
    ctx: ContextoCheckout,
  ): Promise<ItemCarritoResuelto[]> {
    const carrito = await this.conversaciones.obtenerCarrito(
      'whatsapp',
      ctx.identificadorExterno,
    );
    return (await this.catalog.resolverCarrito(carrito)).disponibles;
  }

  /** Pregunta por adicionales solo si hay una pizza a la que pegárselos. */
  async ofrecerAdicionales(
    ctx: ContextoCheckout,
    checkout: CheckoutWhatsapp,
    cuerpo: string,
  ): Promise<boolean> {
    const [disponibles, productos] = await Promise.all([
      this.carritoResuelto(ctx),
      this.catalog.getProductos(),
    ]);
    if (
      pizzasDelCarrito(disponibles).length === 0 ||
      adicionalesDeCatalogo(productos).length === 0
    ) {
      return false;
    }
    checkout.paso = 'adicionales';
    await this.envios.guardar(ctx, checkout);
    await this.envios.botones(
      ctx,
      `${cuerpo}\n\n¿Quieres agregar adicionales (borde de queso, jamón, pepperoni…)? Se cobran según el tamaño de la pizza.`,
      [
        { id: BOTON.adicionalesSi, titulo: 'Sí, agregar' },
        { id: BOTON.adicionalesNo, titulo: 'No, seguir' },
      ],
    );
    return true;
  }

  /**
   * El cliente escribió un adicional ("con borde de queso") en cualquier
   * punto del checkout. true si lo tomó el checkout.
   */
  async adicionalEscrito(
    ctx: ContextoCheckout,
    checkout: CheckoutWhatsapp,
    texto: string,
  ): Promise<boolean> {
    const productos = await this.catalog.getProductos();
    const adicional = adicionalMencionado(
      texto,
      adicionalesDeCatalogo(productos),
    );
    if (!adicional) return false;
    const pizzas = pizzasDelCarrito(await this.carritoResuelto(ctx));
    if (pizzas.length === 0) return false;
    await this.elegirAdicional(ctx, checkout, adicional.id);
    return true;
  }

  /**
   * Responde al paso `adicionales`. 'listo' = seguir con el checkout;
   * 'ignorar' = no era para este paso (responde Gemini).
   */
  async responderAdicionales(
    ctx: ContextoCheckout,
    checkout: CheckoutWhatsapp,
    entrada: EntradaCheckout,
  ): Promise<'esperando' | 'listo' | 'ignorar'> {
    if (entrada.tipo === 'texto') {
      if (respuestaEsNo(entrada.texto)) return 'listo';
      if (respuestaEsSi(entrada.texto)) return this.mostrarAdicionales(ctx);
      return (await this.adicionalEscrito(ctx, checkout, entrada.texto))
        ? 'esperando'
        : 'ignorar';
    }
    if (entrada.tipo !== 'boton') return 'ignorar';
    if (entrada.id === BOTON.adicionalesNo) return 'listo';
    if (entrada.id === BOTON.adicionalesSi) return this.mostrarAdicionales(ctx);
    if (entrada.id.startsWith(PREFIJO_ADICIONAL_PRODUCTO)) {
      const id = entrada.id.slice(PREFIJO_ADICIONAL_PRODUCTO.length);
      await this.elegirAdicional(ctx, checkout, id);
      return 'esperando';
    }
    if (entrada.id.startsWith(PREFIJO_ADICIONAL_PIZZA)) {
      const pizza = entrada.id.slice(PREFIJO_ADICIONAL_PIZZA.length);
      await this.agregarAdicional(ctx, checkout, pizza);
      return 'esperando';
    }
    return 'ignorar';
  }

  /** Lista de adicionales (los 8 caben en una lista de WhatsApp). */
  private async mostrarAdicionales(
    ctx: ContextoCheckout,
  ): Promise<'esperando'> {
    const adicionales = adicionalesDeCatalogo(
      await this.catalog.getProductos(),
    );
    await this.envios.lista(
      ctx,
      '¿Cuál adicional quieres agregar? Su precio depende del tamaño de la pizza.',
      'Ver adicionales',
      adicionales.map((a) => ({
        id: `${PREFIJO_ADICIONAL_PRODUCTO}${a.id}`,
        titulo: nombreCortoAdicional(a.nombre),
      })),
    );
    return 'esperando';
  }

  /** Con una sola pizza lo agrega; con varias pregunta a cuál. */
  private async elegirAdicional(
    ctx: ContextoCheckout,
    checkout: CheckoutWhatsapp,
    productoId: string,
  ): Promise<void> {
    const pizzas = pizzasDelCarrito(await this.carritoResuelto(ctx));
    checkout.paso = 'adicionales';
    checkout.adicionalProductoId = productoId;
    if (pizzas.length <= 1) {
      await this.agregarAdicional(ctx, checkout, pizzas[0]?.varianteId ?? '');
      return;
    }
    await this.envios.guardar(ctx, checkout);
    const topadas = pizzas.slice(0, MAX_FILAS_PIZZAS);
    await this.envios.lista(
      ctx,
      `¿A cuál pizza se lo agrego?\n${topadas.map((p, i) => `${i + 1}. ${p.productoNombre} (${p.varianteNombre})`).join('\n')}`,
      'Elegir pizza',
      topadas.map((p, i) => ({
        id: `${PREFIJO_ADICIONAL_PIZZA}${p.varianteId}`,
        titulo: `Pizza ${i + 1}`,
      })),
    );
  }

  /** Suma el adicional elegido, del mismo tamaño que la pizza, al carrito. */
  private async agregarAdicional(
    ctx: ContextoCheckout,
    checkout: CheckoutWhatsapp,
    pizzaVarianteId: string,
  ): Promise<void> {
    const [disponibles, productos, carrito] = await Promise.all([
      this.carritoResuelto(ctx),
      this.catalog.getProductos(),
      this.conversaciones.obtenerCarrito('whatsapp', ctx.identificadorExterno),
    ]);
    const pizza = pizzasDelCarrito(disponibles).find(
      (p) => p.varianteId === pizzaVarianteId,
    );
    const adicional = productos.find(
      (p) => p.id === checkout.adicionalProductoId,
    );
    const variante =
      pizza && adicional
        ? varianteParaTamano(adicional, pizza.varianteNombre)
        : null;
    delete checkout.adicionalProductoId;
    if (!pizza || !adicional || !variante) {
      await this.envios.guardar(ctx, checkout);
      await this.envios.botones(
        ctx,
        'Ese adicional no está disponible para esa pizza 😕',
        BOTONES_SEGUIR_ADICIONALES,
      );
      return;
    }
    await this.envios.guardarCarrito(ctx, sumarAlCarrito(carrito, variante.id));
    await this.envios.guardar(ctx, checkout);
    await this.envios.botones(
      ctx,
      `Listo ✅ Agregué *${nombreCortoAdicional(adicional.nombre)}* a tu ${pizza.productoNombre} (${pizza.varianteNombre}): ${pesos(variante.precio_oferta ?? variante.precio)}`,
      BOTONES_SEGUIR_ADICIONALES,
    );
  }

  /**
   * Resumen (precios desde la base) + botones de pago. Los puntos no van
   * acá a propósito: se cuentan al día siguiente, en la invitación a
   * repetir (avisos-pedido.ts), como excusa para una nueva compra.
   */
  async pago(
    ctx: ContextoCheckout,
    checkout: CheckoutWhatsapp,
  ): Promise<string> {
    const disponibles = await this.carritoResuelto(ctx);
    if (disponibles.length === 0) {
      await this.envios.limpiar(ctx);
      const texto =
        'Los productos de tu pedido ya no están disponibles 😕 ¿Te mando el menú?';
      await this.envios.texto(ctx, texto);
      return texto;
    }

    const { texto } = armarResumenPedido({
      nombreCompleto: `${checkout.nombre} ${checkout.apellido}`,
      lineas: lineasDeCarrito(disponibles),
      modalidad: checkout.modalidad ?? 'retiro',
      direccion: checkout.direccion ?? null,
      costoDomicilio: COSTO_DOMICILIO_DEFAULT,
      entrega: textoEntrega(checkout.entrega),
      nota: checkout.nota,
    });

    checkout.paso = 'pago';
    await this.envios.guardar(ctx, checkout);
    await this.envios.texto(ctx, texto);
    await this.envios.botones(ctx, '¿Cómo vas a pagar?', BOTONES_PAGO);
    return texto;
  }
}
