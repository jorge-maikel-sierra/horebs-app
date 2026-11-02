import { Injectable, Logger } from '@nestjs/common';
import { type franjaVigente } from '../common/horario';
import { PedidosService } from '../pedidos/pedidos.service';
import { AvisoEquipoService } from './aviso-equipo.service';
import { ConfirmacionPedidoService } from './confirmacion-pedido.service';
import type { ContextoCheckout, MetodoPagoBot } from './checkout-whatsapp';
import {
  ConversacionesService,
  type CheckoutWhatsapp,
  type ItemCarritoPendiente,
} from './conversaciones.service';

/** La franja de entrega ya validada (`franjaVigente` devolvió algo). */
export type FranjaElegida = NonNullable<ReturnType<typeof franjaVigente>>;

/** Lo que recibe `PedidosService.crearDesdeWhatsapp` a partir del checkout terminado. */
export function datosPedidoWhatsapp(entrada: {
  ctx: ContextoCheckout;
  checkout: CheckoutWhatsapp;
  metodo: MetodoPagoBot;
  franja: FranjaElegida;
  carrito: ItemCarritoPendiente[];
}): Parameters<PedidosService['crearDesdeWhatsapp']>[0] {
  const { ctx, checkout, metodo, franja, carrito } = entrada;
  const esDomicilio = checkout.modalidad === 'domicilio';
  return {
    cliente: {
      nombre: checkout.nombre ?? '',
      apellido: checkout.apellido ?? '',
      telefono: ctx.identificadorExterno,
      ...(esDomicilio && checkout.direccion
        ? { direccion: checkout.direccion }
        : {}),
    },
    modalidad: checkout.modalidad ?? 'retiro',
    direccion_entrega: esDomicilio ? checkout.direccion : undefined,
    metodo_pago: metodo,
    notas: checkout.nota,
    programado_para: franja.programadoPara,
    items: carrito.map((i) => ({
      variante_id: i.varianteId,
      cantidad: i.cantidad,
    })),
    idempotency_key: ctx.mensajeId ? `wa:${ctx.mensajeId}` : undefined,
  };
}

/**
 * Último paso del checkout con botones: crea el pedido con los ids exactos
 * del carrito, confirma al cliente y avisa al equipo. Si no se puede
 * registrar, la conversación pasa a una persona: el cliente nunca se queda
 * sin respuesta.
 */
@Injectable()
export class CheckoutPedidoService {
  private readonly logger = new Logger(CheckoutPedidoService.name);

  constructor(
    private readonly pedidos: PedidosService,
    private readonly conversaciones: ConversacionesService,
    private readonly avisoEquipo: AvisoEquipoService,
    private readonly confirmacion: ConfirmacionPedidoService,
  ) {}

  async crear(
    ctx: ContextoCheckout,
    checkout: CheckoutWhatsapp,
    metodo: MetodoPagoBot,
    franja: FranjaElegida,
  ): Promise<void> {
    const carrito = await this.conversaciones.obtenerCarrito(
      'whatsapp',
      ctx.identificadorExterno,
    );
    let pedido: Awaited<ReturnType<PedidosService['crearDesdeWhatsapp']>>;
    try {
      pedido = await this.pedidos.crearDesdeWhatsapp(
        datosPedidoWhatsapp({ ctx, checkout, metodo, franja, carrito }),
      );
    } catch (err) {
      await this.pasarAUnaPersona(ctx, err as Error);
      return;
    }

    const pendienteDePago = await this.confirmacion.confirmar(ctx, {
      nombre: checkout.nombre,
      pedido,
      programadoPara: franja.programadoPara,
      metodo,
    });
    this.logger.log(
      `id=${ctx.identificadorExterno} pedido ${pedido.id} creado por el bot — total=${pedido.total} pago=${metodo}`,
    );
    this.avisarAlEquipo(ctx, {
      id: pedido.id,
      total: pedido.total,
      metodoPago: pendienteDePago ? 'tarjeta (pago pendiente)' : metodo,
    });
  }

  private avisarAlEquipo(
    ctx: ContextoCheckout,
    pedido?: { id: string; total: number; metodoPago: string },
  ): void {
    this.avisoEquipo.notificar({
      canal: 'whatsapp',
      identificadorExterno: ctx.identificadorExterno,
      telefono: ctx.identificadorExterno,
      conversacionId: ctx.conversacionId,
      ...(pedido ? { pedido } : {}),
    });
  }

  private async pasarAUnaPersona(
    ctx: ContextoCheckout,
    err: Error,
  ): Promise<void> {
    this.logger.error(
      `id=${ctx.identificadorExterno} no se pudo crear el pedido: ${err.message}`,
    );
    await this.conversaciones.derivarAHumano(
      'whatsapp',
      ctx.identificadorExterno,
    );
    await this.confirmacion.noSePudoRegistrar(ctx);
    this.avisarAlEquipo(ctx);
  }
}
