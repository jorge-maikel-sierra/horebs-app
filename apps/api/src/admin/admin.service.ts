import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { MailService } from '../mail/mail.service';
import { InventarioService } from '../inventario/inventario.service';
import { ConversacionesService } from '../mensajeria/conversaciones.service';
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

export interface BlogPostAdminDto {
  id: string;
  titulo: string;
  slug: string;
  resumen: string;
  contenido: string;
  palabra_clave: string | null;
  imagen_url: string | null;
  estado: 'borrador' | 'publicado';
  publicado_en: string | null;
  created_at: string;
}

export interface CrearBlogPostInput {
  titulo: string;
  slug: string;
  resumen: string;
  contenido: string;
  palabra_clave?: string;
  imagen_url?: string;
  estado?: 'borrador' | 'publicado';
}

const BLOG_POST_ADMIN_SELECT =
  'id, titulo, slug, resumen, contenido, palabra_clave, imagen_url, estado, publicado_en, created_at';

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
}

export interface ClienteDto {
  id: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  direccion: string | null;
  correo: string | null;
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
  };
  modalidad: string;
  direccion_entrega: string | null;
  costo_domicilio: number;
  metodo_pago: string;
  estado: string;
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

const METODOS_PAGO = ['efectivo', 'transferencia', 'tarjeta'];
const ESTADOS_PEDIDO = [
  'pendiente',
  'confirmado',
  'en_preparacion',
  'entregado',
  'cancelado',
];
const MODALIDADES_VENTA = ['local', 'retiro', 'domicilio'];
const COSTO_DOMICILIO_DEFAULT = 5000;
const PEDIDO_ADMIN_SELECT =
  'id, canal, modalidad, direccion_entrega, costo_domicilio, metodo_pago, estado, total, created_at, clientes(id, nombre, apellido, telefono, direccion), items_pedido(variante_id, nombre_personalizado, cantidad, precio_unitario, variantes_producto(nombre, productos(nombre)))';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly mail: MailService,
    private readonly inventario: InventarioService,
    private readonly conversaciones: ConversacionesService,
  ) {}

  private async descontarStockSeguro(
    items: { variante_id: string; cantidad: number }[],
    pedidoId: string,
    usuarioId: string | null,
  ): Promise<void> {
    try {
      await this.inventario.descontarPorVenta(items, pedidoId, usuarioId);
    } catch (err) {
      this.logger.error(
        `No se pudo descontar stock para el pedido ${pedidoId}: ${(err as Error).message}`,
      );
    }
  }

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
      throw new BadRequestException('El costo de domicilio no puede ser negativo.');
    }

    const client = this.supabase.getClient();
    const { itemsCalculados, total: totalItems } = await this.calcularItemsVenta(
      client,
      input.items,
    );
    const total = totalItems + costoDomicilio;

    // A diferencia de los pedidos web, una venta sin teléfono no se
    // puede "upsertear" (no hay clave para reconocer al mismo cliente)
    // — cada visita sin teléfono queda como su propio registro, y eso
    // está bien para una venta rápida de local.
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

    await this.descontarStockSeguro(
      itemsCalculados
        .filter((i) => i.variante_id)
        .map((i) => ({ variante_id: i.variante_id as string, cantidad: i.cantidad })),
      pedido.id,
      registradoPor,
    );

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
    };
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
      !METODOS_PAGO.includes(cambios.metodo_pago)
    ) {
      throw new BadRequestException('Método de pago inválido.');
    }
    if (cambios.estado !== undefined && !ESTADOS_PEDIDO.includes(cambios.estado)) {
      throw new BadRequestException('Estado inválido.');
    }

    const client = this.supabase.getClient();

    const { data: pedidoActual, error: pedidoError } = await client
      .from('pedidos')
      .select('id, costo_domicilio, estado, items_pedido(variante_id, cantidad)')
      .eq('id', id)
      .maybeSingle();
    if (pedidoError) throw pedidoError;
    if (!pedidoActual) throw new NotFoundException('Pedido no encontrado.');

    const itemsActuales = (
      (pedidoActual.items_pedido ?? []) as { variante_id: string | null; cantidad: number }[]
    )
      .filter((i) => i.variante_id)
      .map((i) => ({ variante_id: i.variante_id as string, cantidad: i.cantidad }));

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
        await this.descontarStockSeguro(
          itemsCalculados
            .filter((i) => i.variante_id)
            .map((i) => ({ variante_id: i.variante_id as string, cantidad: i.cantidad })),
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
      (pedido.items_pedido ?? []) as { variante_id: string | null; cantidad: number }[]
    )
      .filter((i) => i.variante_id)
      .map((i) => ({ variante_id: i.variante_id as string, cantidad: i.cantidad }));

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
      },
      modalidad: p.modalidad,
      direccion_entrega: p.direccion_entrega,
      costo_domicilio: p.costo_domicilio,
      metodo_pago: p.metodo_pago,
      estado: p.estado,
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

    let variantePorId = new Map<string, any>();
    if (varianteIds.length > 0) {
      const { data, error } = await client
        .from('variantes_producto')
        .select('id, nombre, precio, precio_oferta, productos(nombre)')
        .in('id', varianteIds)
        .eq('activo', true);
      if (error) throw error;
      if (!data || data.length !== new Set(varianteIds).size) {
        throw new BadRequestException(
          'Uno o más productos ya no están disponibles.',
        );
      }
      variantePorId = new Map(data.map((v) => [v.id, v]));
    }

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

  async buscarClientes(query: string): Promise<ClienteDto[]> {
    const q = query.trim().replace(/[,()%]/g, '');
    if (!q) return [];

    const { data, error } = await this.supabase
      .getClient()
      .from('clientes')
      .select('id, nombre, apellido, telefono, direccion, correo')
      .or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%,telefono.ilike.%${q}%`)
      .order('nombre')
      .limit(10);

    if (error) throw error;
    return data ?? [];
  }

  async editarCliente(
    id: string,
    cambios: {
      nombre?: string;
      apellido?: string;
      telefono?: string;
      direccion?: string;
      correo?: string;
    },
  ): Promise<ClienteDto> {
    if (cambios.nombre !== undefined && !cambios.nombre.trim()) {
      throw new BadRequestException('El nombre no puede quedar vacío.');
    }

    const payload: Record<string, string | null> = {};
    if (cambios.nombre !== undefined) payload.nombre = cambios.nombre.trim();
    if (cambios.apellido !== undefined) {
      payload.apellido = cambios.apellido.trim() || null;
    }
    if (cambios.telefono !== undefined) {
      payload.telefono = cambios.telefono.trim() || null;
    }
    if (cambios.direccion !== undefined) {
      payload.direccion = cambios.direccion.trim() || null;
    }
    if (cambios.correo !== undefined) {
      payload.correo = cambios.correo.trim() || null;
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('clientes')
      .update(payload)
      .eq('id', id)
      .select('id, nombre, apellido, telefono, direccion, correo')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new BadRequestException(
          'Ya existe otro cliente con ese teléfono.',
        );
      }
      throw error;
    }
    return data;
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

  async obtenerConfiguracion(): Promise<{ correo_domiciliario: string | null }> {
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
    return { recordatorio_minutos: recordatorioMinutos, oferta_minutos: ofertaMinutos };
  }

  async actualizarConfiguracionSeguimiento(recordatorioMinutos: number, ofertaMinutos: number) {
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
    return { recordatorio_minutos: recordatorioMinutos, oferta_minutos: ofertaMinutos };
  }

  async listarConversacionesBot() {
    return this.conversaciones.listar();
  }

  async actualizarEstadoConversacion(id: string, estado: string) {
    if (estado !== 'bot' && estado !== 'derivado') {
      throw new BadRequestException('Estado inválido — debe ser "bot" o "derivado".');
    }
    await this.conversaciones.actualizarEstadoManual(id, estado as EstadoConversacion);
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

  async listarBlogPosts(): Promise<BlogPostAdminDto[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('blog_posts')
      .select(BLOG_POST_ADMIN_SELECT)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async crearBlogPost(input: CrearBlogPostInput): Promise<BlogPostAdminDto> {
    if (!input.titulo?.trim()) {
      throw new BadRequestException('El título es obligatorio.');
    }
    if (!input.slug?.trim()) {
      throw new BadRequestException('El slug es obligatorio.');
    }
    if (!input.resumen?.trim()) {
      throw new BadRequestException('El resumen es obligatorio.');
    }
    if (!input.contenido?.trim()) {
      throw new BadRequestException('El contenido es obligatorio.');
    }

    const estado = input.estado ?? 'borrador';
    const { data, error } = await this.supabase
      .getClient()
      .from('blog_posts')
      .insert({
        titulo: input.titulo.trim(),
        slug: input.slug.trim(),
        resumen: input.resumen.trim(),
        contenido: input.contenido,
        palabra_clave: input.palabra_clave?.trim() || null,
        imagen_url: input.imagen_url?.trim() || null,
        estado,
        publicado_en: estado === 'publicado' ? new Date().toISOString() : null,
      })
      .select(BLOG_POST_ADMIN_SELECT)
      .single();

    if (error) throw error;
    return data;
  }

  async actualizarBlogPost(
    id: string,
    input: Partial<CrearBlogPostInput>,
  ): Promise<BlogPostAdminDto> {
    const client = this.supabase.getClient();
    const { data: actual, error: errorActual } = await client
      .from('blog_posts')
      .select('estado, publicado_en')
      .eq('id', id)
      .maybeSingle();
    if (errorActual) throw errorActual;
    if (!actual) throw new NotFoundException('Artículo no encontrado.');

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (input.titulo !== undefined) payload.titulo = input.titulo.trim();
    if (input.slug !== undefined) payload.slug = input.slug.trim();
    if (input.resumen !== undefined) payload.resumen = input.resumen.trim();
    if (input.contenido !== undefined) payload.contenido = input.contenido;
    if (input.palabra_clave !== undefined) {
      payload.palabra_clave = input.palabra_clave?.trim() || null;
    }
    if (input.imagen_url !== undefined) {
      payload.imagen_url = input.imagen_url?.trim() || null;
    }
    if (input.estado !== undefined) {
      payload.estado = input.estado;
      if (input.estado === 'publicado' && !actual.publicado_en) {
        payload.publicado_en = new Date().toISOString();
      }
    }

    const { data, error } = await client
      .from('blog_posts')
      .update(payload)
      .eq('id', id)
      .select(BLOG_POST_ADMIN_SELECT)
      .single();

    if (error) throw error;
    return data;
  }

  async eliminarBlogPost(id: string): Promise<void> {
    const { error, count } = await this.supabase
      .getClient()
      .from('blog_posts')
      .delete({ count: 'exact' })
      .eq('id', id);
    if (error) throw error;
    if (!count) throw new NotFoundException('Artículo no encontrado.');
  }
}
