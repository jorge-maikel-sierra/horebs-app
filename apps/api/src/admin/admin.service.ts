import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { calcularItems, ItemInput } from '../pedidos/calcular-items';
import type { Rol } from '../auth/roles.decorator';

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
  items: ItemInput[];
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
    producto_nombre: string;
    variante_nombre: string;
    cantidad: number;
  }[];
}

export interface UsuarioStaffDto {
  id: string;
  email: string;
  rol: Rol;
  created_at: string;
}

const METODOS_PAGO = ['efectivo', 'transferencia', 'tarjeta'];
const MODALIDADES_VENTA = ['local', 'retiro', 'domicilio'];
const COSTO_DOMICILIO_DEFAULT = 5000;

@Injectable()
export class AdminService {
  constructor(private readonly supabase: SupabaseService) {}

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
    const { itemsCalculados, total: totalItems } = await calcularItems(
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
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        subtotal: i.subtotal,
      })),
    );
    if (itemsError) throw itemsError;

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
      .select(
        'id, canal, modalidad, direccion_entrega, costo_domicilio, metodo_pago, estado, total, created_at, clientes(id, nombre, apellido, telefono, direccion), items_pedido(cantidad, variantes_producto(nombre, productos(nombre)))',
      )
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    return (data ?? []).map((p) => {
      const cliente = (p as any).clientes;
      const items = ((p as any).items_pedido ?? []) as any[];
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
          producto_nombre: i.variantes_producto?.productos?.nombre ?? '',
          variante_nombre: i.variantes_producto?.nombre ?? '',
          cantidad: i.cantidad,
        })),
      };
    });
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
