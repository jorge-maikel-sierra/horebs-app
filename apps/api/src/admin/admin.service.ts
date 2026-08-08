import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { calcularItems, ItemInput } from '../pedidos/calcular-items';
import type { Rol } from '../auth/roles.decorator';

export interface CrearVentaInput {
  cliente: {
    nombre: string;
    telefono?: string;
  };
  metodo_pago: 'efectivo' | 'transferencia' | 'tarjeta';
  notas?: string;
  items: ItemInput[];
}

export interface VentaDto {
  id: string;
  cliente: { nombre: string; telefono: string | null };
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

export interface UsuarioStaffDto {
  id: string;
  email: string;
  rol: Rol;
  created_at: string;
}

const METODOS_PAGO = ['efectivo', 'transferencia', 'tarjeta'];

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

    const client = this.supabase.getClient();
    const { itemsCalculados, total } = await calcularItems(client, input.items);

    // A diferencia de los pedidos web, una venta de mostrador sin
    // teléfono no se puede "upsertear" (no hay clave para reconocer al
    // mismo cliente) — cada visita sin teléfono queda como su propio
    // registro, y eso está bien para una venta rápida de local.
    const telefono = input.cliente.telefono?.trim();
    const { data: cliente, error: clienteError } = telefono
      ? await client
          .from('clientes')
          .upsert(
            { nombre: input.cliente.nombre, telefono },
            { onConflict: 'telefono' },
          )
          .select('id, nombre, telefono')
          .single()
      : await client
          .from('clientes')
          .insert({ nombre: input.cliente.nombre })
          .select('id, nombre, telefono')
          .single();

    if (clienteError) throw clienteError;

    const { data: pedido, error: pedidoError } = await client
      .from('pedidos')
      .insert({
        cliente_id: cliente.id,
        modalidad: 'mostrador',
        metodo_pago: input.metodo_pago,
        estado: 'entregado',
        canal: 'pos',
        registrado_por: registradoPor,
        total,
        notas: input.notas ?? null,
      })
      .select('id, metodo_pago, total, created_at')
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
      cliente: { nombre: cliente.nombre, telefono: cliente.telefono },
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
