import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { MailService } from '../mail/mail.service';
import { InventarioService } from '../inventario/inventario.service';
import { ConversionesMetaService } from '../mensajeria/conversiones-meta.service';
import { PuntosService } from '../clientes/puntos.service';
import { METODOS_PAGO } from '../common/metodos-pago';
import { COSTO_DOMICILIO_DEFAULT } from '../common/costos';
import { errorDeBase } from '../common/error-de-base';
import { calcularItemsVenta } from './calcular-items-venta';
import { itemsConVariante } from './items-stock';
import {
  MODALIDADES_VENTA,
  type CrearVentaInput,
  type VentaDto,
} from './pedidos-admin.tipos';

/** Venta de mostrador (POS): cliente, pedido, ítems, stock, puntos y avisos. */
@Injectable()
export class VentasService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly mail: MailService,
    private readonly inventario: InventarioService,
    private readonly conversionesMeta: ConversionesMetaService,
    private readonly puntos: PuntosService,
  ) {}

  async crearVenta(
    input: CrearVentaInput,
    registradoPor: string,
  ): Promise<VentaDto> {
    if (!input.cliente?.nombre?.trim()) {
      throw new BadRequestException('Falta el nombre del cliente.');
    }
    if (!METODOS_PAGO.includes(input.metodo_pago)) {
      throw new BadRequestException('Método de pago inválido.');
    }
    if (!MODALIDADES_VENTA.includes(input.modalidad)) {
      throw new BadRequestException('Modalidad inválida.');
    }
    if (input.modalidad === 'domicilio' && !input.direccion_entrega?.trim()) {
      throw new BadRequestException('Falta la dirección de entrega.');
    }

    const costoDomicilio =
      input.modalidad === 'domicilio'
        ? (input.costo_domicilio ?? COSTO_DOMICILIO_DEFAULT)
        : 0;
    if (costoDomicilio < 0) {
      throw new BadRequestException(
        'El costo de domicilio no puede ser negativo.',
      );
    }

    const client = this.supabase.getClient();
    const { itemsCalculados, total: totalItems } = await calcularItemsVenta(
      client,
      input.items,
    );
    const subtotal = totalItems + costoDomicilio;

    // A diferencia de los pedidos web, una venta sin teléfono no se
    // puede "upsertear" (no hay clave para reconocer al mismo cliente)
    // — cada visita sin teléfono queda como su propio registro, y eso
    // está bien para una venta rápida de local. Tampoco puede acumular
    // ni canjear puntos: sin teléfono no hay forma de reconocer al mismo
    // cliente en la próxima visita.
    const telefono = input.cliente.telefono?.trim();
    const apellido = input.cliente.apellido?.trim() || null;
    const correo = input.cliente.correo?.trim() || null;
    const cedula = input.cliente.cedula?.trim() || null;
    const { data: cliente, error: clienteError } = telefono
      ? await client
          .from('clientes')
          .upsert(
            {
              nombre: input.cliente.nombre,
              apellido,
              telefono,
              correo,
              cedula,
            },
            { onConflict: 'telefono' },
          )
          .select('id, nombre, apellido, telefono, correo, cedula')
          .single()
      : await client
          .from('clientes')
          .insert({ nombre: input.cliente.nombre, apellido, correo, cedula })
          .select('id, nombre, apellido, telefono, correo, cedula')
          .single();

    if (clienteError) throw errorDeBase(clienteError);

    const canje =
      telefono && input.usar_puntos
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
        estado: 'entregado',
        canal: 'pos',
        registrado_por: registradoPor,
        total,
        notas: input.notas ?? null,
        puntos_canjeados: canje.puntos,
        descuento_puntos: canje.descuento,
      })
      .select(
        'id, modalidad, direccion_entrega, costo_domicilio, metodo_pago, total, created_at',
      )
      .single();

    if (pedidoError) throw errorDeBase(pedidoError);

    const { error: itemsError } = await client.from('items_pedido').insert(
      itemsCalculados.map((i) => ({
        pedido_id: pedido.id,
        variante_id: i.variante_id,
        nombre_personalizado: i.nombre_personalizado,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        subtotal: i.subtotal,
      })),
    );
    if (itemsError) throw errorDeBase(itemsError);

    // Si el cliente llegó por un anuncio Click-to-WhatsApp, Meta se entera
    // de la venta (atribuida por teléfono). No espera ni puede fallar la venta.
    this.conversionesMeta.avisarCompra({
      telefono: cliente.telefono,
      pedidoId: pedido.id,
      total: Number(pedido.total),
    });

    await this.inventario.descontarPorVentaSeguro(
      itemsConVariante(itemsCalculados),
      pedido.id,
      registradoPor,
    );

    let puntosGanados = 0;
    if (telefono) {
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
      puntosGanados = await this.puntos.otorgarPuntosPorCompraSeguro(
        cliente.id,
        total,
        pedido.id,
      );
    }

    if (pedido.modalidad === 'domicilio' && pedido.direccion_entrega) {
      this.mail.enviarNotificacionDomicilio({
        pedidoId: pedido.id,
        clienteNombre: cliente.nombre,
        clienteTelefono: cliente.telefono,
        direccionEntrega: pedido.direccion_entrega,
        items: itemsCalculados.map((i) => ({
          cantidad: i.cantidad,
          nombre: i.variante_nombre
            ? `${i.producto_nombre} (${i.variante_nombre})`
            : i.producto_nombre,
          precioUnitario: i.precio_unitario,
        })),
        costoDomicilio: pedido.costo_domicilio,
        metodoPago: pedido.metodo_pago,
        total: pedido.total,
        notas: input.notas ?? null,
      });
    }

    return {
      id: pedido.id,
      cliente: {
        nombre: cliente.nombre,
        apellido: cliente.apellido,
        telefono: cliente.telefono,
        correo: cliente.correo,
        cedula: cliente.cedula,
      },
      modalidad: pedido.modalidad,
      direccion_entrega: pedido.direccion_entrega,
      costo_domicilio: pedido.costo_domicilio,
      metodo_pago: pedido.metodo_pago,
      total: pedido.total,
      created_at: pedido.created_at,
      items: itemsCalculados.map((i) => ({
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
}
