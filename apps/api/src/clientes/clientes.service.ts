import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface ClienteDto {
  id: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  direccion: string | null;
  correo: string | null;
}

export interface ClienteDetalleDto extends ClienteDto {
  puntos_actuales: number;
  puntos_ultima_actividad: string | null;
  total_pedidos: number;
  total_gastado: number;
  ultimo_pedido: string | null;
}

export interface EditarClienteInput {
  nombre?: string;
  apellido?: string;
  telefono?: string;
  direccion?: string;
  correo?: string;
}

const SELECT_CLIENTE = 'id, nombre, apellido, telefono, direccion, correo';

/**
 * Extraído de AdminService — mismo criterio que BlogService: CRUD de
 * cliente vive en su propio módulo en vez de seguir creciendo el
 * god-service.
 */
@Injectable()
export class ClientesService {
  constructor(private readonly supabase: SupabaseService) {}

  async buscar(query: string): Promise<ClienteDto[]> {
    const q = query.trim().replace(/[,()%]/g, '');
    if (!q) return [];

    const { data, error } = await this.supabase
      .getClient()
      .from('clientes')
      .select(SELECT_CLIENTE)
      .or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%,telefono.ilike.%${q}%`)
      .order('nombre')
      .limit(10);

    if (error) throw error;
    return data ?? [];
  }

  /**
   * Listado para la página admin/clientes — a diferencia de `buscar`
   * (typeahead del POS/pedidos, siempre requiere texto), esto trae los
   * clientes más recientes sin filtro para poblar la vista inicial.
   */
  async listar(): Promise<ClienteDto[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('clientes')
      .select(SELECT_CLIENTE)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    return data ?? [];
  }

  async obtenerDetalle(id: string): Promise<ClienteDetalleDto> {
    const { data: cliente, error } = await this.supabase
      .getClient()
      .from('clientes')
      .select(`${SELECT_CLIENTE}, puntos_actuales, puntos_ultima_actividad`)
      .eq('id', id)
      .single();
    if (error) throw error;

    const { data: pedidos, error: pedidosError } = await this.supabase
      .getClient()
      .from('pedidos')
      .select('total, created_at')
      .eq('cliente_id', id)
      .order('created_at', { ascending: false });
    if (pedidosError) throw pedidosError;

    const lista = pedidos ?? [];
    return {
      ...cliente,
      total_pedidos: lista.length,
      total_gastado: lista.reduce((acc, p) => acc + p.total, 0),
      ultimo_pedido: lista[0]?.created_at ?? null,
    };
  }

  async editar(id: string, cambios: EditarClienteInput): Promise<ClienteDto> {
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
      .select(SELECT_CLIENTE)
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
}
