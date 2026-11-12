import { normalizarAtribucion, type ContextoHttp } from './atribucion-web';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { errorDeBase } from '../common/error-de-base';
import { MailService } from '../mail/mail.service';
import { InventarioService } from '../inventario/inventario.service';
import { PuntosService, type CanjeCalculado } from '../clientes/puntos.service';
import { elegirPromocion, promocionDePedido } from '../common/promocion';
import { calcularItems, type ItemCalculado } from './calcular-items';
import { normalizarTelefonoCO } from './normalizar-telefono';
import {
  armarPedidoDto,
  avisoDomicilio,
  costoDomicilioDeCheckout,
  datosClienteUpsert,
  filasItemsPedido,
  itemsParaDescuento,
  mapPedido,
  payloadPedido,
} from './pedidos-reglas';
import {
  CLIENTE_PEDIDO_SELECT,
  PEDIDO_COMPLETO_SELECT,
  PEDIDO_CREADO_SELECT,
  type CanalPedido,
  type CrearPedidoInput,
  type CrearPedidoWhatsappInput,
  type DatosPedido,
  type FilaClientePedido,
  type FilaPedidoCompleto,
  type FilaPedidoCreado,
  type PedidoDto,
} from './pedidos.tipos';
import { validarDatosPedido } from './validar-pedido';

export type * from './pedidos.tipos';

const POSTGRES_UNIQUE_VIOLATION = '23505';
const SIN_CANJE: CanjeCalculado = { puntos: 0, descuento: 0 };

@Injectable()
export class PedidosService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly mail: MailService,
    private readonly inventario: InventarioService,
    private readonly puntos: PuntosService,
  ) {}

  async crear(
    input: CrearPedidoInput,
    http?: ContextoHttp,
  ): Promise<PedidoDto> {
    validarDatosPedido(input, 'web');
    return this.registrar(
      {
        ...input,
        atribucion_web: normalizarAtribucion(input.atribucion, http),
      },
      'web',
    );
  }

  /**
   * Mismo núcleo que el checkout web (precios desde la base, stock, puntos,
   * aviso de domicilio, idempotencia) — el pedido entra `pendiente` y el
   * equipo lo avanza desde /admin/pedidos.
   */
  async crearDesdeBot(
    input: CrearPedidoWhatsappInput,
    canal: CanalPedido = 'whatsapp',
  ): Promise<PedidoDto> {
    const datos = {
      ...input,
      cliente: {
        ...input.cliente,
        telefono: normalizarTelefonoCO(input.cliente.telefono),
      },
    };
    validarDatosPedido(datos, canal);
    return this.registrar(datos, canal);
  }

  crearDesdeWhatsapp(input: CrearPedidoWhatsappInput): Promise<PedidoDto> {
    return this.crearDesdeBot(input, 'whatsapp');
  }

  async obtener(id: string): Promise<PedidoDto> {
    const { data, error } = await this.supabase
      .getClient()
      .from('pedidos')
      .select(PEDIDO_COMPLETO_SELECT)
      .eq('id', id)
      .maybeSingle<FilaPedidoCompleto>();
    if (error) throw errorDeBase(error);
    if (!data) throw new NotFoundException('Pedido no encontrado.');
    return mapPedido(data);
  }

  private async registrar(
    input: DatosPedido,
    canal: CanalPedido,
  ): Promise<PedidoDto> {
    const client = this.supabase.getClient();
    const { itemsCalculados, total: subtotalItems } = await calcularItems(
      client,
      input.items,
    );
    const costoDomicilio = costoDomicilioDeCheckout(input.modalidad);
    // El descuento es solo sobre las pizzas: el domicilio se suma después.
    const promo = promocionDePedido(
      elegirPromocion(
        Boolean(input.aplicar_promocion),
        Boolean(input.oferta_seguimiento),
      ),
      itemsCalculados,
      input.notas,
    );
    const subtotal = subtotalItems - promo.descuento + costoDomicilio;

    const cliente = await this.guardarCliente(client, input.cliente);
    const canje = input.usar_puntos
      ? await this.puntos.calcularCanjeMaximo(cliente.id, subtotal)
      : SIN_CANJE;
    const total = subtotal - canje.descuento;

    const pedido = await this.insertarPedido(
      client,
      payloadPedido(
        { ...input, notas: promo.notas },
        { clienteId: cliente.id, canal, costoDomicilio, total, canje },
      ),
      input.idempotency_key,
    );
    // El insert chocó contra el unique de idempotency_key: ya existe un
    // pedido de este mismo intento de checkout (reintento de red o doble
    // clic más rápido que el disabled del botón) — se devuelve ese en vez
    // de duplicarlo.
    if (!pedido) return this.obtenerPorIdempotencyKey(input.idempotency_key);

    await this.registrarItems(client, pedido.id, itemsCalculados);
    const puntosGanados = await this.moverPuntos(
      cliente.id,
      pedido.id,
      canje,
      total,
    );

    const aviso = avisoDomicilio(pedido, cliente, itemsCalculados);
    if (aviso) this.mail.enviarNotificacionDomicilio(aviso);

    return armarPedidoDto({
      pedido,
      cliente,
      items: itemsCalculados,
      canje,
      puntosGanados,
    });
  }

  private async registrarItems(
    client: SupabaseClient,
    pedidoId: string,
    items: ItemCalculado[],
  ): Promise<void> {
    const { error } = await client
      .from('items_pedido')
      .insert(filasItemsPedido(pedidoId, items));
    if (error) throw errorDeBase(error);

    await this.inventario.descontarPorVentaSeguro(
      itemsParaDescuento(items),
      pedidoId,
      null,
    );
  }

  /**
   * Upsert atómico por teléfono: evita la condición de carrera de un
   * select-then-insert cuando dos pedidos del mismo cliente llegan a la vez
   * (ej. doble click en "Confirmar pedido").
   */
  private async guardarCliente(
    client: SupabaseClient,
    cliente: DatosPedido['cliente'],
  ): Promise<FilaClientePedido> {
    const { data, error } = await client
      .from('clientes')
      .upsert(datosClienteUpsert(cliente), { onConflict: 'telefono' })
      .select(CLIENTE_PEDIDO_SELECT)
      .single<FilaClientePedido>();
    if (error) throw errorDeBase(error);
    return data;
  }

  /** `null` si el insert chocó contra la idempotency_key de un pedido ya creado. */
  private async insertarPedido(
    client: SupabaseClient,
    payload: Record<string, unknown>,
    idempotencyKey: string | undefined,
  ): Promise<FilaPedidoCreado | null> {
    const { data, error } = await client
      .from('pedidos')
      .insert(payload)
      .select(PEDIDO_CREADO_SELECT)
      .single<FilaPedidoCreado>();
    if (!error) return data;
    if (error.code === POSTGRES_UNIQUE_VIOLATION && idempotencyKey) return null;
    throw errorDeBase(error);
  }

  /**
   * Descuenta el canje y otorga los puntos ganados. Si el canje falla DESPUÉS
   * de crear el pedido, no se tumba la venta: se deja marcado para revisarlo.
   */
  private async moverPuntos(
    clienteId: string,
    pedidoId: string,
    canje: CanjeCalculado,
    total: number,
  ): Promise<number> {
    if (canje.puntos > 0) {
      try {
        await this.puntos.registrarCanje(clienteId, canje.puntos, pedidoId);
      } catch (err) {
        await this.puntos.marcarCanjePendiente(
          pedidoId,
          (err as Error).message,
        );
      }
    }
    return this.puntos.otorgarPuntosPorCompraSeguro(clienteId, total, pedidoId);
  }

  private async obtenerPorIdempotencyKey(
    idempotencyKey: string | undefined,
  ): Promise<PedidoDto> {
    const { data, error } = await this.supabase
      .getClient()
      .from('pedidos')
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .single<{ id: string }>();
    if (error) throw errorDeBase(error);
    return this.obtener(data.id);
  }
}
