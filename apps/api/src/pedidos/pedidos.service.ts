import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { errorDeBase } from '../common/error-de-base';
import { MailService } from '../mail/mail.service';
import { InventarioService } from '../inventario/inventario.service';
import { PuntosService } from '../clientes/puntos.service';
import { calcularItems } from './calcular-items';
import { COSTO_DOMICILIO_DEFAULT } from '../common/costos';

import { normalizarTelefonoCO } from './normalizar-telefono';
import { validarDatosPedido } from './validar-pedido';
import type {
  CanalPedido,
  CrearPedidoInput,
  CrearPedidoWhatsappInput,
  DatosPedido,
  PedidoDto,
} from './pedidos.tipos';

export type * from './pedidos.tipos';

@Injectable()
export class PedidosService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly mail: MailService,
    private readonly inventario: InventarioService,
    private readonly puntos: PuntosService,
  ) {}

  async crear(input: CrearPedidoInput): Promise<PedidoDto> {
    validarDatosPedido(input, 'web');
    return this.registrar(input, 'web');
  }

  /**
   * Mismo núcleo que el checkout web (precios desde la base, stock, puntos,
   * aviso de domicilio, idempotencia) — el pedido entra `pendiente` y el
   * equipo lo avanza desde /admin/pedidos.
   */
  async crearDesdeWhatsapp(
    input: CrearPedidoWhatsappInput,
  ): Promise<PedidoDto> {
    const datos = {
      ...input,
      cliente: {
        ...input.cliente,
        telefono: normalizarTelefonoCO(input.cliente.telefono),
      },
    };
    validarDatosPedido(datos, 'whatsapp');
    return this.registrar(datos, 'whatsapp');
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
    // Costo de domicilio fijo, no editable por el cliente — a diferencia
    // del POS, acá nunca se confía en un valor que mande el frontend.
    const costoDomicilio =
      input.modalidad === 'domicilio' ? COSTO_DOMICILIO_DEFAULT : 0;
    const subtotal = subtotalItems + costoDomicilio;

    // Upsert atómico por teléfono: evita la condición de carrera de un
    // select-then-insert cuando dos pedidos del mismo cliente llegan a la
    // vez (ej. doble click en "Confirmar pedido"). No se incluye
    // `direccion` cuando este pedido no la trae, para no pisar una
    // dirección ya guardada de un pedido anterior.
    const clienteUpsert: Record<string, string> = {
      nombre: input.cliente.nombre,
      apellido: input.cliente.apellido,
      telefono: input.cliente.telefono,
    };
    // Mismo criterio que la dirección: sin correo (pedido por WhatsApp) no
    // se pisa el que ya tenga guardado el cliente.
    if (input.cliente.correo) {
      clienteUpsert.correo = input.cliente.correo;
    }
    if (input.cliente.direccion) {
      clienteUpsert.direccion = input.cliente.direccion;
    }

    const { data: cliente, error: clienteError } = await client
      .from('clientes')
      .upsert(clienteUpsert, { onConflict: 'telefono' })
      .select('id, nombre, apellido, telefono, correo, direccion')
      .single();

    if (clienteError) {
      throw errorDeBase(clienteError);
    }

    const canje = input.usar_puntos
      ? await this.puntos.calcularCanjeMaximo(cliente.id, subtotal)
      : { puntos: 0, descuento: 0 };
    const total = subtotal - canje.descuento;

    const { data: pedido, error: pedidoError } = await client
      .from('pedidos')
      .insert({
        cliente_id: cliente.id,
        modalidad: input.modalidad,
        direccion_entrega:
          input.modalidad === 'domicilio' ? input.direccion_entrega : null,
        costo_domicilio: costoDomicilio,
        metodo_pago: input.metodo_pago,
        canal,
        ...(input.programado_para
          ? { programado_para: input.programado_para }
          : {}),
        total,
        notas: input.notas ?? null,
        idempotency_key: input.idempotency_key ?? null,
        puntos_canjeados: canje.puntos,
        descuento_puntos: canje.descuento,
      })
      .select(
        'id, modalidad, direccion_entrega, costo_domicilio, metodo_pago, estado, total, notas, created_at',
      )
      .single();

    if (pedidoError) {
      // El insert chocó contra la restricción unique de idempotency_key:
      // ya existe un pedido de este mismo intento de checkout (reintento
      // de red o doble clic más rápido que el disabled del botón) — se
      // devuelve el pedido ya creado en vez de duplicarlo.
      if (pedidoError.code === '23505' && input.idempotency_key) {
        return this.obtenerPorIdempotencyKey(input.idempotency_key);
      }
      throw errorDeBase(pedidoError);
    }

    const { error: itemsError } = await client.from('items_pedido').insert(
      itemsCalculados.map((i) => ({
        pedido_id: pedido.id,
        variante_id: i.variante_id,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        subtotal: i.subtotal,
      })),
    );
    if (itemsError) {
      throw errorDeBase(itemsError);
    }

    await this.inventario.descontarPorVentaSeguro(
      itemsCalculados.map((i) => ({
        variante_id: i.variante_id,
        cantidad: i.cantidad,
      })),
      pedido.id,
      null,
    );

    if (canje.puntos > 0) {
      try {
        await this.puntos.registrarCanje(cliente.id, canje.puntos, pedido.id);
      } catch (err) {
        await this.puntos.marcarCanjePendiente(
          pedido.id,
          (err as Error).message,
        );
      }
    }
    const puntosGanados = await this.puntos.otorgarPuntosPorCompraSeguro(
      cliente.id,
      total,
      pedido.id,
    );

    if (pedido.modalidad === 'domicilio' && pedido.direccion_entrega) {
      this.mail.enviarNotificacionDomicilio({
        pedidoId: pedido.id,
        clienteNombre: cliente.nombre,
        clienteTelefono: cliente.telefono,
        direccionEntrega: pedido.direccion_entrega,
        items: itemsCalculados.map((i) => ({
          cantidad: i.cantidad,
          nombre: `${i.producto_nombre} (${i.variante_nombre})`,
          precioUnitario: i.precio_unitario,
        })),
        costoDomicilio: pedido.costo_domicilio || null,
        metodoPago: pedido.metodo_pago,
        total: pedido.total,
        notas: pedido.notas,
      });
    }

    return {
      id: pedido.id,
      cliente: {
        nombre: cliente.nombre,
        apellido: cliente.apellido,
        telefono: cliente.telefono,
        correo: cliente.correo,
        direccion: cliente.direccion,
      },
      modalidad: pedido.modalidad,
      direccion_entrega: pedido.direccion_entrega,
      costo_domicilio: pedido.costo_domicilio,
      metodo_pago: pedido.metodo_pago,
      estado: pedido.estado,
      total: pedido.total,
      notas: pedido.notas,
      created_at: pedido.created_at,
      items: itemsCalculados.map((i) => ({
        variante_id: i.variante_id,
        producto_nombre: i.producto_nombre,
        variante_nombre: i.variante_nombre,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        subtotal: i.subtotal,
      })),
      puntos_canjeados: canje.puntos,
      descuento_puntos: canje.descuento,
      puntos_ganados: puntosGanados,
    };
  }

  private async obtenerPorIdempotencyKey(
    idempotencyKey: string,
  ): Promise<PedidoDto> {
    const { data, error } = await this.supabase
      .getClient()
      .from('pedidos')
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .single();
    if (error) {
      throw errorDeBase(error);
    }
    return this.obtener(data.id);
  }

  async obtener(id: string): Promise<PedidoDto> {
    const client = this.supabase.getClient();
    const { data: pedido, error } = await client
      .from('pedidos')
      .select(
        'id, modalidad, direccion_entrega, costo_domicilio, metodo_pago, estado, total, notas, created_at, puntos_canjeados, descuento_puntos, puntos_ganados, clientes(nombre, apellido, telefono, correo, direccion), items_pedido(variante_id, cantidad, precio_unitario, subtotal, variantes_producto(nombre, productos(nombre)))',
      )
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw errorDeBase(error);
    }
    if (!pedido) throw new NotFoundException('Pedido no encontrado.');

    const cliente = (pedido as any).clientes;
    const items = ((pedido as any).items_pedido ?? []) as any[];

    return {
      id: pedido.id,
      cliente: {
        nombre: cliente?.nombre ?? '',
        apellido: cliente?.apellido ?? null,
        telefono: cliente?.telefono ?? '',
        correo: cliente?.correo ?? null,
        direccion: cliente?.direccion ?? null,
      },
      modalidad: pedido.modalidad,
      direccion_entrega: pedido.direccion_entrega,
      costo_domicilio: pedido.costo_domicilio,
      metodo_pago: pedido.metodo_pago,
      estado: pedido.estado,
      total: pedido.total,
      notas: pedido.notas,
      created_at: pedido.created_at,
      items: items.map((i) => ({
        variante_id: i.variante_id,
        producto_nombre: i.variantes_producto?.productos?.nombre ?? '',
        variante_nombre: i.variantes_producto?.nombre ?? '',
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        subtotal: i.subtotal,
      })),
      puntos_canjeados: pedido.puntos_canjeados,
      descuento_puntos: pedido.descuento_puntos,
      puntos_ganados: pedido.puntos_ganados,
    };
  }
}
