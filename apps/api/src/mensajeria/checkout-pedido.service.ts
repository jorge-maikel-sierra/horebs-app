import { Injectable, Logger } from '@nestjs/common';
import { etiquetaHora, type franjaVigente } from '../common/horario';
import { PedidosService } from '../pedidos/pedidos.service';
import {
  AvisoEquipoService,
  INICIO_CONFIRMACION_PEDIDO,
} from './aviso-equipo.service';
import { CheckoutEnviosService } from './checkout-envios.service';
import type { ContextoCheckout, MetodoPagoBot } from './checkout-whatsapp';
import {
  ConversacionesService,
  type CheckoutWhatsapp,
  type ItemCarritoPendiente,
} from './conversaciones.service';
import { pesos } from './resumen-pedido';

// Dato confirmado en CLAUDE.md — el mismo que muestra el sitio web en la
// confirmación de un pedido con transferencia (apps/web/src/lib/negocio.ts).
const TRANSFERENCIA = { banco: 'Nu', llave: '1118843420' };
const LARGO_CODIGO_PEDIDO = 8;

/** La franja de entrega ya validada (`franjaVigente` devolvió algo). */
export type FranjaElegida = NonNullable<ReturnType<typeof franjaVigente>>;

/** Mensaje de confirmación al cliente; con transferencia incluye la llave. */
export function textoConfirmacionPedido(datos: {
  nombre: string | undefined;
  pedido: { id: string; total: number };
  programadoPara: string | null | undefined;
  metodo: MetodoPagoBot;
}): string {
  const { nombre, pedido, programadoPara, metodo } = datos;
  return [
    `${INICIO_CONFIRMACION_PEDIDO} ${nombre}! Recibimos tu pedido *#${pedido.id.slice(0, LARGO_CODIGO_PEDIDO)}* por *${pesos(pedido.total)}*.`,
    programadoPara
      ? `🕒 Quedó reservado para las *${etiquetaHora(programadoPara)}*.`
      : null,
    'Te aviso por acá cuando lo confirmemos y cuando vaya en camino 🍕',
    metodo === 'transferencia'
      ? `\nPara transferir: *Banco ${TRANSFERENCIA.banco}*, llave *${TRANSFERENCIA.llave}*. Mandanos el comprobante por acá.`
      : null,
  ]
    .filter((l) => l !== null)
    .join('\n');
}

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
    private readonly envios: CheckoutEnviosService,
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

    await this.envios.limpiar(ctx);
    await this.envios.texto(
      ctx,
      textoConfirmacionPedido({
        nombre: checkout.nombre,
        pedido,
        programadoPara: franja.programadoPara,
        metodo,
      }),
    );
    this.logger.log(
      `id=${ctx.identificadorExterno} pedido ${pedido.id} creado por el bot — total=${pedido.total} pago=${metodo}`,
    );
    this.avisarAlEquipo(ctx, {
      id: pedido.id,
      total: pedido.total,
      metodoPago: metodo,
    });
  }

  private avisarAlEquipo(
    ctx: ContextoCheckout,
    pedido?: { id: string; total: number; metodoPago: MetodoPagoBot },
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
    await this.envios.texto(
      ctx,
      'No pude registrar tu pedido 😕 Ya le avisé al equipo y una persona te escribe por acá en un momento.',
    );
    this.avisarAlEquipo(ctx);
  }
}
