import { Injectable, Logger } from '@nestjs/common';
import { BoldService } from '../bold/bold.service';
import { firmaBoldValida } from '../bold/bold-firma';
import { errorDeBase } from '../common/error-de-base';
import { idCortoPedido } from '../common/pedido-numero';
import { SupabaseService } from '../supabase/supabase.service';
import { AvisoEquipoService } from './aviso-equipo.service';
import { MetaGraphService } from './meta-graph.service';
import type { EventoBold, PagoEstado, PedidoCobrado } from './pago-bold.tipos';
import { pesos } from './resumen-pedido';

const URL_CHECKOUT_BOLD = 'https://checkout.bold.co';
const PREFIJO_WHATSAPP_CO = '57';

/** Qué estado deja cada evento y desde cuáles se puede llegar a él. */
const TRANSICIONES = new Map<
  string,
  { nuevo: PagoEstado; desde: PagoEstado[] }
>([
  ['SALE_APPROVED', { nuevo: 'pagado', desde: ['pendiente', 'rechazado'] }],
  ['SALE_REJECTED', { nuevo: 'rechazado', desde: ['pendiente'] }],
]);

export function textoPagoRecibido(nombre: string, total: number): string {
  return `¡Pago recibido, ${nombre}! 🎉 Acreditamos ${pesos(total)}. Ya estamos preparando tu pedido 🍕`;
}

export function textoPagoRechazado(linkId: string): string {
  return `Tu pago con tarjeta no pasó 😕 Puedes intentarlo de nuevo con el mismo enlace: ${URL_CHECKOUT_BOLD}/${linkId}\nO escríbenos y te ayudamos a pagar en efectivo o por transferencia.`;
}

/**
 * Cobro con tarjeta por el Link de pagos de Bold: crea el enlace de un pedido
 * y procesa el webhook que avisa si se pagó. Nunca guarda datos de tarjeta
 * (el cliente paga en la página de Bold).
 */
@Injectable()
export class PagoBoldService {
  private readonly logger = new Logger(PagoBoldService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly bold: BoldService,
    private readonly metaGraph: MetaGraphService,
    private readonly avisoEquipo: AvisoEquipoService,
  ) {}

  /** URL de pago del pedido, o null si Bold está apagado o falló (el equipo cobra a mano). */
  async iniciarCobro(pedido: {
    id: string;
    total: number;
  }): Promise<string | null> {
    if (!this.bold.habilitado()) return null;
    try {
      const link = await this.bold.crearLink({
        referencia: pedido.id,
        total: pedido.total,
        descripcion: `Pizzería Horebs, pedido #${idCortoPedido(pedido.id)}`,
      });
      const { error } = await this.supabase
        .getClient()
        .from('pedidos')
        .update({ bold_link_id: link.id, pago_estado: 'pendiente' })
        .eq('id', pedido.id);
      if (error) throw errorDeBase(error);
      return link.url;
    } catch (err) {
      this.logger.error(
        `Pedido ${pedido.id}: no se pudo generar el cobro con Bold — ${(err as Error).message}`,
      );
      return null;
    }
  }

  firmaValida(rawBody: Buffer, firma: string | undefined): boolean {
    const secreto = this.bold.secreto();
    return Boolean(secreto) && firmaBoldValida(rawBody, firma, secreto ?? '');
  }

  /** Aplica un evento de Bold; los repetidos o de otro pedido no hacen nada. */
  async procesarEvento(evento: EventoBold): Promise<void> {
    const transicion = TRANSICIONES.get(evento.type ?? '');
    const linkId = evento.data?.metadata?.reference;
    if (!transicion || !linkId) return;

    const pedido = await this.actualizarEstado(linkId, transicion);
    if (!pedido) return;

    const pagado = transicion.nuevo === 'pagado';
    this.logger.log(`Pedido ${pedido.id}: pago ${transicion.nuevo}`);
    this.avisoEquipo.notificarPago({
      pedidoId: pedido.id,
      total: pedido.total,
      pagado,
    });
    await this.avisarAlCliente(pedido, pagado, linkId);
  }

  /** El UPDATE condicionado al estado de origen es lo que vuelve idempotente al webhook. */
  private async actualizarEstado(
    linkId: string,
    transicion: { nuevo: PagoEstado; desde: PagoEstado[] },
  ): Promise<PedidoCobrado | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('pedidos')
      .update({
        pago_estado: transicion.nuevo,
        ...(transicion.nuevo === 'pagado'
          ? { pagado_en: new Date().toISOString() }
          : {}),
      })
      .eq('bold_link_id', linkId)
      .in('pago_estado', transicion.desde)
      .select('id, total, clientes(nombre, telefono)')
      .returns<PedidoCobrado[]>();
    if (error) throw errorDeBase(error);
    return data?.[0] ?? null;
  }

  private async avisarAlCliente(
    pedido: PedidoCobrado,
    pagado: boolean,
    linkId: string,
  ): Promise<void> {
    if (!pedido.clientes?.telefono) return;
    const texto = pagado
      ? textoPagoRecibido(pedido.clientes.nombre, pedido.total)
      : textoPagoRechazado(linkId);
    try {
      await this.metaGraph.enviarMensajeSesion(
        'whatsapp',
        `${PREFIJO_WHATSAPP_CO}${pedido.clientes.telefono}`,
        texto,
      );
    } catch (err) {
      this.logger.warn(
        `Pedido ${pedido.id}: no se pudo avisar el pago al cliente — ${(err as Error).message}`,
      );
    }
  }
}
