import { Injectable } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PuntosService } from '../clientes/puntos.service';
import { errorDeBase } from '../common/error-de-base';
import { InventarioService } from '../inventario/inventario.service';
import { SupabaseService } from '../supabase/supabase.service';
import { AvisosVentaService } from './avisos-venta.service';
import { calcularItemsVenta } from './calcular-items-venta';
import { itemsConVariante } from './items-stock';
import type {
  CrearVentaInput,
  FilaClienteVenta,
  FilaPedidoVenta,
  ItemVentaCalculado,
  VentaDto,
} from './pedidos-admin.tipos';
import {
  armarVentaDto,
  costoDomicilioDeVenta,
  datosClienteDeVenta,
  validarVenta,
  type CanjeDeVenta,
  type DatosClienteVenta,
} from './venta-reglas';

const CLIENTE_SELECT = 'id, nombre, apellido, telefono, correo, cedula';
const PEDIDO_VENTA_SELECT =
  'id, modalidad, direccion_entrega, costo_domicilio, metodo_pago, total, created_at';
const SIN_CANJE: CanjeDeVenta = { puntos: 0, descuento: 0 };

/** Lo que `registrarPedido` necesita para insertar el pedido de la venta. */
interface PedidoPorRegistrar {
  input: CrearVentaInput;
  clienteId: string;
  costoDomicilio: number;
  total: number;
  canje: CanjeDeVenta;
  registradoPor: string;
}

/** Venta de mostrador (POS): cliente, pedido, ítems, stock, puntos y avisos. */
@Injectable()
export class VentasService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly inventario: InventarioService,
    private readonly puntos: PuntosService,
    private readonly avisos: AvisosVentaService,
  ) {}

  async crearVenta(
    input: CrearVentaInput,
    registradoPor: string,
  ): Promise<VentaDto> {
    validarVenta(input);
    const costoDomicilio = costoDomicilioDeVenta(input);

    const client = this.supabase.getClient();
    const { itemsCalculados, total: totalItems } = await calcularItemsVenta(
      client,
      input.items,
    );
    const subtotal = totalItems + costoDomicilio;

    const datosCliente = datosClienteDeVenta(input.cliente);
    const cliente = await this.guardarCliente(client, datosCliente);

    // Sin teléfono no hay forma de reconocer al mismo cliente en la próxima
    // visita: esa venta no puede acumular ni canjear puntos.
    const reconocible = Boolean(datosCliente.telefono);
    const canje = await this.calcularCanje(cliente.id, subtotal, {
      quiereUsar: reconocible && Boolean(input.usar_puntos),
    });
    const total = subtotal - canje.descuento;

    const pedido = await this.registrarPedido(client, {
      input,
      clienteId: cliente.id,
      costoDomicilio,
      total,
      canje,
      registradoPor,
    });
    await this.registrarItems(client, pedido.id, itemsCalculados);
    await this.inventario.descontarPorVentaSeguro(
      itemsConVariante(itemsCalculados),
      pedido.id,
      registradoPor,
    );

    const puntosGanados = reconocible
      ? await this.moverPuntos(cliente.id, pedido.id, { canje, total })
      : 0;
    this.avisos.avisar({
      pedido,
      cliente,
      items: itemsCalculados,
      notas: input.notas ?? null,
    });

    return armarVentaDto({
      pedido,
      cliente,
      items: itemsCalculados,
      canje,
      puntosGanados,
    });
  }

  /**
   * A diferencia de los pedidos web, una venta sin teléfono no se puede
   * "upsertear": cada visita sin teléfono queda como su propio registro, y
   * está bien para una venta rápida de local.
   */
  private async guardarCliente(
    client: SupabaseClient,
    datos: DatosClienteVenta,
  ): Promise<FilaClienteVenta> {
    const { telefono, ...base } = datos;
    const tabla = client.from('clientes');
    const consulta = telefono
      ? tabla.upsert({ ...base, telefono }, { onConflict: 'telefono' })
      : tabla.insert(base);
    const { data, error } = await consulta
      .select(CLIENTE_SELECT)
      .single<FilaClienteVenta>();
    if (error) throw errorDeBase(error);
    return data;
  }

  private async calcularCanje(
    clienteId: string,
    subtotal: number,
    opciones: { quiereUsar: boolean },
  ): Promise<CanjeDeVenta> {
    if (!opciones.quiereUsar) return SIN_CANJE;
    return this.puntos.calcularCanjeMaximo(clienteId, subtotal);
  }

  private async registrarPedido(
    client: SupabaseClient,
    venta: PedidoPorRegistrar,
  ): Promise<FilaPedidoVenta> {
    const { input, canje } = venta;
    const { data, error } = await client
      .from('pedidos')
      .insert({
        cliente_id: venta.clienteId,
        modalidad: input.modalidad,
        direccion_entrega:
          input.modalidad === 'domicilio' ? input.direccion_entrega : null,
        costo_domicilio: venta.costoDomicilio,
        metodo_pago: input.metodo_pago,
        estado: 'entregado',
        canal: 'pos',
        registrado_por: venta.registradoPor,
        total: venta.total,
        notas: input.notas ?? null,
        puntos_canjeados: canje.puntos,
        descuento_puntos: canje.descuento,
      })
      .select(PEDIDO_VENTA_SELECT)
      .single<FilaPedidoVenta>();
    if (error) throw errorDeBase(error);
    return data;
  }

  private async registrarItems(
    client: SupabaseClient,
    pedidoId: string,
    items: ItemVentaCalculado[],
  ): Promise<void> {
    const { error } = await client.from('items_pedido').insert(
      items.map((i) => ({
        pedido_id: pedidoId,
        variante_id: i.variante_id,
        nombre_personalizado: i.nombre_personalizado,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        subtotal: i.subtotal,
      })),
    );
    if (error) throw errorDeBase(error);
  }

  /**
   * Descuenta el canje (si falla, el pedido queda marcado para revisión a
   * mano) y otorga los puntos ganados. Devuelve los puntos ganados.
   */
  private async moverPuntos(
    clienteId: string,
    pedidoId: string,
    venta: { canje: CanjeDeVenta; total: number },
  ): Promise<number> {
    if (venta.canje.puntos > 0) {
      try {
        await this.puntos.registrarCanje(
          clienteId,
          venta.canje.puntos,
          pedidoId,
        );
      } catch (err) {
        await this.puntos.marcarCanjePendiente(
          pedidoId,
          (err as Error).message,
        );
      }
    }
    return this.puntos.otorgarPuntosPorCompraSeguro(
      clienteId,
      venta.total,
      pedidoId,
    );
  }
}
