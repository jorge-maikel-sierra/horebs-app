import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { MailService } from '../mail/mail.service';
import { InventarioService } from '../inventario/inventario.service';
import { ConversacionesService } from '../mensajeria/conversaciones.service';
import { MetaGraphService } from '../mensajeria/meta-graph.service';
import { FacturaService } from '../facturas/factura.service';
import { PuntosService } from '../clientes/puntos.service';
import { METODOS_PAGO, type MetodoPago } from '../common/metodos-pago';
import { COSTO_DOMICILIO_DEFAULT } from '../common/costos';
import { obtenerVariantesActivas } from '../pedidos/calcular-items';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Rol } from '../auth/roles.decorator';
import type { EstadoConversacion } from '../mensajeria/conversaciones.service';

/**
 * A diferencia del carrito público (calcularItems, precio 100% desde la
 * base), el POS es un mostrador operado por personal autenticado — acá
 * sí se confía en el precio que manda el cliente cuando lo manda, para
 * poder cobrar bordes, adicionales u otros ajustes puntuales.
 */
export interface ItemVentaInput {
  variante_id?: string;
  nombre_personalizado?: string;
  precio_unitario?: number;
  cantidad: number;
}

interface ItemVentaCalculado {
  variante_id: string | null;
  nombre_personalizado: string | null;
  producto_nombre: string;
  variante_nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface CrearVentaInput {
  cliente: {
    nombre: string;
    apellido?: string;
    telefono?: string;
    correo?: string;
  };
  modalidad: 'local' | 'retiro' | 'domicilio';
  direccion_entrega?: string;
  costo_domicilio?: number;
  metodo_pago: 'efectivo' | 'transferencia' | 'tarjeta';
  notas?: string;
  items: ItemVentaInput[];
  usar_puntos?: boolean;
}

export interface VentaDto {
  id: string;
  cliente: {
    nombre: string;
    apellido: string | null;
    telefono: string | null;
    correo: string | null;
  };
  modalidad: string;
  direccion_entrega: string | null;
  costo_domicilio: number;
  metodo_pago: string;
  total: number;
  created_at: string;
  items: {
    producto_nombre: string;
    variante_nombre: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
  }[];
  puntos_canjeados: number;
  descuento_puntos: number;
  puntos_ganados: number;
}

export interface PedidoAdminDto {
  id: string;
  canal: string;
  cliente: {
    id: string;
    nombre: string;
    apellido: string | null;
    telefono: string | null;
    direccion: string | null;
    correo: string | null;
  };
  modalidad: string;
  direccion_entrega: string | null;
  costo_domicilio: number;
  metodo_pago: string;
  estado: string;
  stock_status: string;
  total: number;
  created_at: string;
  items: {
    variante_id: string | null;
    producto_nombre: string;
    variante_nombre: string;
    cantidad: number;
    precio_unitario: number;
  }[];
}

export interface UsuarioStaffDto {
  id: string;
  email: string;
  rol: Rol;
  created_at: string;
}

const ESTADOS_PEDIDO = [
  'pendiente',
  'confirmado',
  'en_preparacion',
  'entregado',
  'cancelado',
];
const MODALIDADES_VENTA = ['local', 'retiro', 'domicilio'];
/**
 * `clientes.telefono` normalmente se guarda en formato local colombiano
 * (3157861208, sin indicativo), pero la Graph API de WhatsApp necesita el
 * ID completo con indicativo de país sin el "+" (573157861208). Espejo de
 * `normalizarTelefonoCO` en pedidos.service.ts, que hace lo inverso.
 */
function telefonoAWhatsappId(telefono: string): string {
  const digitos = telefono.replace(/\D/g, '');
  if (digitos.length === 10 && digitos.startsWith('3')) {
    return `57${digitos}`;
  }
  return digitos;
}

const PEDIDO_ADMIN_SELECT =
  'id, canal, modalidad, direccion_entrega, costo_domicilio, metodo_pago, estado, stock_status, total, created_at, clientes(id, nombre, apellido, telefono, direccion, correo), items_pedido(variante_id, nombre_personalizado, cantidad, precio_unitario, variantes_producto(nombre, productos(nombre)))';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly mail: MailService,
    private readonly inventario: InventarioService,
    private readonly conversaciones: ConversacionesService,
    private readonly metaGraph: MetaGraphService,
    private readonly factura: FacturaService,
    private readonly puntos: PuntosService,
  ) {}

  private async revertirStockSeguro(
    items: { variante_id: string; cantidad: number }[],
    pedidoId: string,
    usuarioId: string | null,
  ): Promise<void> {
    try {
      await this.inventario.revertirPorVenta(items, pedidoId, usuarioId);
    } catch (err) {
      this.logger.error(
        `No se pudo revertir stock para el pedido ${pedidoId}: ${(err as Error).message}`,
      );
    }
  }

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
    const { itemsCalculados, total: totalItems } =
      await this.calcularItemsVenta(client, input.items);
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
    const { data: cliente, error: clienteError } = telefono
      ? await client
          .from('clientes')
          .upsert(
            { nombre: input.cliente.nombre, apellido, telefono, correo },
            { onConflict: 'telefono' },
          )
          .select('id, nombre, apellido, telefono, correo')
          .single()
      : await client
          .from('clientes')
          .insert({ nombre: input.cliente.nombre, apellido, correo })
          .select('id, nombre, apellido, telefono, correo')
          .single();

    if (clienteError) throw clienteError;

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

    if (pedidoError) throw pedidoError;

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
    if (itemsError) throw itemsError;

    await this.inventario.descontarPorVentaSeguro(
      itemsCalculados
        .filter((i) => i.variante_id)
        .map((i) => ({
          variante_id: i.variante_id as string,
          cantidad: i.cantidad,
        })),
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

  async obtenerPedido(id: string): Promise<PedidoAdminDto> {
    const { data, error } = await this.supabase
      .getClient()
      .from('pedidos')
      .select(PEDIDO_ADMIN_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException('Pedido no encontrado.');
    return this.mapPedido(data);
  }

  async generarFacturaPdf(
    id: string,
  ): Promise<{ buffer: Buffer; nombreArchivo: string }> {
    const pedido = await this.obtenerPedido(id);
    const buffer = await this.factura.generarPdf(pedido);
    return { buffer, nombreArchivo: this.factura.nombreArchivo(pedido) };
  }

  async enviarFacturaPorCorreo(
    id: string,
  ): Promise<{ enviado: true; destino: string }> {
    const pedido = await this.obtenerPedido(id);
    if (!pedido.cliente.correo) {
      throw new BadRequestException(
        'El cliente no tiene un correo registrado.',
      );
    }
    const buffer = await this.factura.generarPdf(pedido);
    const { asunto, texto, html } = this.factura.datosCorreo(pedido);
    try {
      await this.mail.enviarConAdjunto({
        destino: pedido.cliente.correo,
        asunto,
        texto,
        html,
        adjuntoNombre: this.factura.nombreArchivo(pedido),
        adjuntoPdf: buffer,
      });
    } catch (err) {
      throw new BadRequestException(
        `No se pudo enviar el correo: ${(err as Error).message}`,
      );
    }
    return { enviado: true, destino: pedido.cliente.correo };
  }

  async enviarFacturaPorWhatsapp(
    id: string,
  ): Promise<{ enviado: true; destino: string }> {
    const pedido = await this.obtenerPedido(id);
    if (!pedido.cliente.telefono) {
      throw new BadRequestException(
        'El cliente no tiene un teléfono registrado.',
      );
    }
    const destinatarioId = telefonoAWhatsappId(pedido.cliente.telefono);
    const buffer = await this.factura.generarPdf(pedido);
    try {
      await this.metaGraph.enviarDocumentoWhatsapp(
        destinatarioId,
        buffer,
        this.factura.nombreArchivo(pedido),
        `Comprobante de tu pedido #${pedido.id.slice(0, 8).toUpperCase()}`,
      );
    } catch (err) {
      throw new BadRequestException(
        `No se pudo enviar por WhatsApp: ${(err as Error).message}. Puede ser porque ` +
          'pasaron más de 24h desde el último mensaje del cliente — WhatsApp solo deja ' +
          'mandar mensajes gratis dentro de esa ventana.',
      );
    }
    return { enviado: true, destino: destinatarioId };
  }

  async listarPedidos(): Promise<PedidoAdminDto[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('pedidos')
      .select(PEDIDO_ADMIN_SELECT)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    return (data ?? []).map((p) => this.mapPedido(p));
  }

  async editarPedido(
    id: string,
    cambios: {
      metodo_pago?: string;
      estado?: string;
      items?: ItemVentaInput[];
    },
    usuarioId: string,
  ): Promise<PedidoAdminDto> {
    if (
      cambios.metodo_pago !== undefined &&
      !METODOS_PAGO.includes(cambios.metodo_pago as MetodoPago)
    ) {
      throw new BadRequestException('Método de pago inválido.');
    }
    if (
      cambios.estado !== undefined &&
      !ESTADOS_PEDIDO.includes(cambios.estado)
    ) {
      throw new BadRequestException('Estado inválido.');
    }

    const client = this.supabase.getClient();

    const { data: pedidoActual, error: pedidoError } = await client
      .from('pedidos')
      .select(
        'id, costo_domicilio, estado, items_pedido(variante_id, cantidad)',
      )
      .eq('id', id)
      .maybeSingle();
    if (pedidoError) throw pedidoError;
    if (!pedidoActual) throw new NotFoundException('Pedido no encontrado.');

    const itemsActuales = (
      (pedidoActual.items_pedido ?? []) as {
        variante_id: string | null;
        cantidad: number;
      }[]
    )
      .filter((i) => i.variante_id)
      .map((i) => ({
        variante_id: i.variante_id as string,
        cantidad: i.cantidad,
      }));

    const cancelando =
      cambios.estado === 'cancelado' && pedidoActual.estado !== 'cancelado';

    const payload: Record<string, string | number> = {};
    if (cambios.metodo_pago !== undefined) {
      payload.metodo_pago = cambios.metodo_pago;
    }
    if (cambios.estado !== undefined) {
      payload.estado = cambios.estado;
    }

    if (cambios.items !== undefined) {
      // Se reemplazan los items: primero se revierte el stock de los
      // viejos (siempre), y solo se aplica el de los nuevos si el
      // pedido no está siendo cancelado en la misma llamada.
      if (itemsActuales.length > 0) {
        await this.revertirStockSeguro(itemsActuales, id, usuarioId);
      }

      const { itemsCalculados, total: totalItems } =
        await this.calcularItemsVenta(client, cambios.items);

      const { error: deleteError } = await client
        .from('items_pedido')
        .delete()
        .eq('pedido_id', id);
      if (deleteError) throw deleteError;

      const { error: insertError } = await client.from('items_pedido').insert(
        itemsCalculados.map((i) => ({
          pedido_id: id,
          variante_id: i.variante_id,
          nombre_personalizado: i.nombre_personalizado,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
          subtotal: i.subtotal,
        })),
      );
      if (insertError) throw insertError;

      payload.total = totalItems + (pedidoActual.costo_domicilio ?? 0);

      if (!cancelando) {
        await this.inventario.descontarPorVentaSeguro(
          itemsCalculados
            .filter((i) => i.variante_id)
            .map((i) => ({
              variante_id: i.variante_id as string,
              cantidad: i.cantidad,
            })),
          id,
          usuarioId,
        );
      }
    } else if (cancelando && itemsActuales.length > 0) {
      await this.revertirStockSeguro(itemsActuales, id, usuarioId);
    }

    if (Object.keys(payload).length > 0) {
      const { error: updateError } = await client
        .from('pedidos')
        .update(payload)
        .eq('id', id);
      if (updateError) throw updateError;
    }

    const { data: actualizado, error: obtenerError } = await client
      .from('pedidos')
      .select(PEDIDO_ADMIN_SELECT)
      .eq('id', id)
      .single();
    if (obtenerError) throw obtenerError;
    return this.mapPedido(actualizado);
  }

  async eliminarPedido(id: string, usuarioId: string): Promise<void> {
    const client = this.supabase.getClient();
    const { data: pedido, error: pedidoError } = await client
      .from('pedidos')
      .select('id, items_pedido(variante_id, cantidad)')
      .eq('id', id)
      .maybeSingle();
    if (pedidoError) throw pedidoError;
    if (!pedido) throw new NotFoundException('Pedido no encontrado.');

    const itemsActuales = (
      (pedido.items_pedido ?? []) as {
        variante_id: string | null;
        cantidad: number;
      }[]
    )
      .filter((i) => i.variante_id)
      .map((i) => ({
        variante_id: i.variante_id as string,
        cantidad: i.cantidad,
      }));

    // items_pedido tiene ON DELETE CASCADE hacia pedidos — se borran solos.
    const { error, count } = await client
      .from('pedidos')
      .delete({ count: 'exact' })
      .eq('id', id);
    if (error) throw error;
    if (!count) throw new NotFoundException('Pedido no encontrado.');

    if (itemsActuales.length > 0) {
      await this.revertirStockSeguro(itemsActuales, id, usuarioId);
    }
  }

  private mapPedido(p: any): PedidoAdminDto {
    const cliente = p.clientes;
    const items = (p.items_pedido ?? []) as any[];
    return {
      id: p.id,
      canal: p.canal,
      cliente: {
        id: cliente?.id ?? '',
        nombre: cliente?.nombre ?? '',
        apellido: cliente?.apellido ?? null,
        telefono: cliente?.telefono ?? null,
        direccion: cliente?.direccion ?? null,
        correo: cliente?.correo ?? null,
      },
      modalidad: p.modalidad,
      direccion_entrega: p.direccion_entrega,
      costo_domicilio: p.costo_domicilio,
      metodo_pago: p.metodo_pago,
      estado: p.estado,
      stock_status: p.stock_status,
      total: p.total,
      created_at: p.created_at,
      items: items.map((i) => ({
        variante_id: i.variante_id,
        producto_nombre:
          i.variantes_producto?.productos?.nombre ??
          i.nombre_personalizado ??
          '',
        variante_nombre: i.variantes_producto?.nombre ?? '',
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
      })),
    };
  }

  /**
   * Calcula los items de una venta de mostrador. A diferencia de
   * calcularItems (carrito público), acá se admite: (a) un precio
   * manual por item — para bordes, adicionales o ajustes puntuales —
   * y (b) items sin variante_id, con nombre_personalizado libre,
   * para productos que no están en el catálogo.
   */
  private async calcularItemsVenta(
    client: SupabaseClient,
    items: ItemVentaInput[],
  ): Promise<{ itemsCalculados: ItemVentaCalculado[]; total: number }> {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('El carrito está vacío.');
    }

    const varianteIds = items
      .filter((i) => i.variante_id)
      .map((i) => i.variante_id as string);

    const variantePorId = await obtenerVariantesActivas(client, varianteIds);

    const itemsCalculados: ItemVentaCalculado[] = items.map((item) => {
      if (!Number.isInteger(item.cantidad) || item.cantidad <= 0) {
        throw new BadRequestException('Cantidad inválida.');
      }
      if (
        item.precio_unitario !== undefined &&
        (typeof item.precio_unitario !== 'number' || item.precio_unitario < 0)
      ) {
        throw new BadRequestException('El precio no puede ser negativo.');
      }

      if (item.variante_id) {
        const variante = variantePorId.get(item.variante_id);
        if (!variante) {
          throw new BadRequestException('Uno de los productos no existe.');
        }
        const precioCatalogo = variante.precio_oferta ?? variante.precio;
        const precioUnitario = item.precio_unitario ?? precioCatalogo;
        return {
          variante_id: item.variante_id,
          nombre_personalizado: null,
          producto_nombre: variante.productos?.nombre ?? '',
          variante_nombre: variante.nombre,
          cantidad: item.cantidad,
          precio_unitario: precioUnitario,
          subtotal: precioUnitario * item.cantidad,
        };
      }

      if (!item.nombre_personalizado?.trim()) {
        throw new BadRequestException(
          'Falta el nombre del producto personalizado.',
        );
      }
      if (item.precio_unitario === undefined) {
        throw new BadRequestException(
          'Falta el precio del producto personalizado.',
        );
      }
      const nombre = item.nombre_personalizado.trim();
      return {
        variante_id: null,
        nombre_personalizado: nombre,
        producto_nombre: nombre,
        variante_nombre: '',
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        subtotal: item.precio_unitario * item.cantidad,
      };
    });

    const total = itemsCalculados.reduce((acc, i) => acc + i.subtotal, 0);
    return { itemsCalculados, total };
  }

  async listarUsuarios(): Promise<UsuarioStaffDto[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('perfiles_staff')
      .select('id, email, rol, created_at')
      .order('created_at');

    if (error) throw error;
    return data ?? [];
  }

  async asignarRol(email: string, rol: Rol): Promise<UsuarioStaffDto> {
    const client = this.supabase.getClient();
    const emailNormalizado = email.trim().toLowerCase();

    const usuario = await this.buscarUsuarioPorEmail(emailNormalizado);
    if (!usuario) {
      throw new NotFoundException(
        'Esa persona todavía no tiene una cuenta. Tiene que registrarse en /cuenta antes de poder asignarle un rol.',
      );
    }

    const { data, error } = await client
      .from('perfiles_staff')
      .upsert(
        { id: usuario.id, email: usuario.email ?? emailNormalizado, rol },
        { onConflict: 'id' },
      )
      .select('id, email, rol, created_at')
      .single();

    if (error) throw error;
    return data;
  }

  async obtenerConfiguracion(): Promise<{
    correo_domiciliario: string | null;
  }> {
    const { data, error } = await this.supabase
      .getClient()
      .from('configuracion')
      .select('valor')
      .eq('clave', 'correo_domiciliario')
      .maybeSingle();

    if (error) throw error;
    return { correo_domiciliario: data?.valor ?? null };
  }

  async actualizarConfiguracion(
    correoDomiciliario: string,
  ): Promise<{ correo_domiciliario: string | null }> {
    const correo = correoDomiciliario.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      throw new BadRequestException('El correo no es válido.');
    }

    const { error } = await this.supabase
      .getClient()
      .from('configuracion')
      .update({ valor: correo, updated_at: new Date().toISOString() })
      .eq('clave', 'correo_domiciliario');

    if (error) throw error;
    return { correo_domiciliario: correo };
  }

  async obtenerConfiguracionSeguimiento() {
    const { recordatorioMinutos, ofertaMinutos } =
      await this.conversaciones.obtenerConfiguracionSeguimiento();
    return {
      recordatorio_minutos: recordatorioMinutos,
      oferta_minutos: ofertaMinutos,
    };
  }

  async actualizarConfiguracionSeguimiento(
    recordatorioMinutos: number,
    ofertaMinutos: number,
  ) {
    if (
      !Number.isInteger(recordatorioMinutos) ||
      !Number.isInteger(ofertaMinutos) ||
      recordatorioMinutos < 1 ||
      ofertaMinutos < 1
    ) {
      throw new BadRequestException('Los minutos deben ser enteros positivos.');
    }
    await this.conversaciones.actualizarConfiguracionSeguimiento(
      recordatorioMinutos,
      ofertaMinutos,
    );
    return {
      recordatorio_minutos: recordatorioMinutos,
      oferta_minutos: ofertaMinutos,
    };
  }

  async listarConversacionesBot() {
    return this.conversaciones.listar();
  }

  async actualizarEstadoConversacion(id: string, estado: string) {
    if (estado !== 'bot' && estado !== 'derivado') {
      throw new BadRequestException(
        'Estado inválido — debe ser "bot" o "derivado".',
      );
    }
    await this.conversaciones.actualizarEstadoManual(id, estado);
    return { id, estado };
  }

  async quitarRol(id: string): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('perfiles_staff')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  private async buscarUsuarioPorEmail(email: string) {
    const client = this.supabase.getClient();
    const maxPaginas = 5;

    for (let page = 1; page <= maxPaginas; page++) {
      const { data, error } = await client.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) throw error;

      const encontrado = data.users.find(
        (u) => u.email?.toLowerCase() === email,
      );
      if (encontrado) return encontrado;
      if (data.users.length < 200) break;
    }

    return null;
  }
}
