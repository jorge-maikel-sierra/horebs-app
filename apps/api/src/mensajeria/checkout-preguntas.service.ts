import { Injectable } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import { COSTO_DOMICILIO_DEFAULT } from '../common/costos';
import { estadoAtencion, franjasEntrega } from '../common/horario';
import { PedidosConsultasService } from '../pedidos/pedidos-consultas.service';
import { CheckoutEnviosService } from './checkout-envios.service';
import {
  BOTON,
  BOTONES_PAGO,
  lineasDeCarrito,
  MENSAJE_CERRADO,
  PREFIJO_HORA,
  textoEntrega,
  type ContextoCheckout,
} from './checkout-whatsapp';
import {
  ConversacionesService,
  type CheckoutWhatsapp,
} from './conversaciones.service';
import { armarResumenPedido } from './resumen-pedido';

/**
 * Las preguntas del checkout con botones: hora de entrega, dirección (o
 * ubicación) y resumen con los botones de pago. Cada una deja guardado el
 * paso en que quedó el cliente.
 */
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

  /** Ofrece la dirección del último pedido; si no hay, pide la ubicación. */
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
      await this.ubicacion(ctx, checkout);
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

  async ubicacion(
    ctx: ContextoCheckout,
    checkout: CheckoutWhatsapp,
  ): Promise<void> {
    checkout.paso = 'direccion';
    await this.envios.guardar(ctx, checkout);
    await this.envios.pedirUbicacion(
      ctx,
      '¿A dónde te lo llevamos? Tocá *Enviar ubicación* o escribime la dirección con barrio y alguna referencia.',
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
    const carrito = await this.conversaciones.obtenerCarrito(
      'whatsapp',
      ctx.identificadorExterno,
    );
    const { disponibles } = await this.catalog.resolverCarrito(carrito);
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
