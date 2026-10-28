import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ClientesDirectorioService } from './clientes-directorio.service';
import { errorDeBase } from '../common/error-de-base';

export interface ClienteDto {
  id: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  direccion: string | null;
  correo: string | null;
  cedula: string | null;
}

export interface ClienteDetalleDto extends ClienteDto {
  created_at: string;
  puntos_actuales: number;
  puntos_ultima_actividad: string | null;
  total_pedidos: number;
  total_gastado: number;
  ultimo_pedido: string | null;
}

export interface PedidoClienteDto {
  id: string;
  canal: string;
  modalidad: string;
  metodo_pago: string;
  estado: string;
  total: number;
  costo_domicilio: number;
  created_at: string;
  /** Una línea por producto: "Pizza Hawaiana (Grande)" × cantidad. */
  items: { nombre: string; cantidad: number }[];
}

interface FilaPedidoCliente {
  id: string;
  canal: string;
  modalidad: string;
  metodo_pago: string;
  estado: string;
  total: number;
  costo_domicilio: number;
  created_at: string;
  items_pedido:
    | {
        nombre_personalizado: string | null;
        cantidad: number;
        variantes_producto: {
          nombre: string;
          productos: { nombre: string } | null;
        } | null;
      }[]
    | null;
}

// Tope de seguridad: el total real sale de obtenerDetalle, esto es solo el historial.
const MAX_PEDIDOS_CLIENTE = 200;

export interface EditarClienteInput {
  nombre?: string;
  apellido?: string;
  telefono?: string;
  direccion?: string;
  correo?: string;
  cedula?: string;
}

const SELECT_CLIENTE =
  'id, nombre, apellido, telefono, direccion, correo, cedula';

/**
 * Extraído del antiguo servicio de admin — mismo criterio que BlogService: CRUD de
 * cliente vive en su propio módulo en vez de seguir creciendo el
 * god-service.
 */
@Injectable()
export class ClientesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly directorio: ClientesDirectorioService,
  ) {}

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

    if (error) throw errorDeBase(error);
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

    if (error) throw errorDeBase(error);
    return data ?? [];
  }

  async obtenerDetalle(id: string): Promise<ClienteDetalleDto> {
    const { data: cliente, error } = await this.supabase
      .getClient()
      .from('clientes')
      .select(
        `${SELECT_CLIENTE}, created_at, puntos_actuales, puntos_ultima_actividad`,
      )
      .eq('id', id)
      .single();
    if (error) throw errorDeBase(error);

    const { data: pedidos, error: pedidosError } = await this.supabase
      .getClient()
      .from('pedidos')
      .select('total, created_at')
      .eq('cliente_id', id)
      .order('created_at', { ascending: false });
    if (pedidosError) throw errorDeBase(pedidosError);

    const lista = pedidos ?? [];
    return {
      ...cliente,
      total_pedidos: lista.length,
      total_gastado: lista.reduce((acc, p) => acc + p.total, 0),
      ultimo_pedido: lista[0]?.created_at ?? null,
    };
  }

  async listarPedidos(id: string): Promise<PedidoClienteDto[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('pedidos')
      .select(
        'id, canal, modalidad, metodo_pago, estado, total, costo_domicilio, created_at, items_pedido(nombre_personalizado, cantidad, variantes_producto(nombre, productos(nombre)))',
      )
      .eq('cliente_id', id)
      .order('created_at', { ascending: false })
      .limit(MAX_PEDIDOS_CLIENTE);
    if (error) throw errorDeBase(error);

    return ((data ?? []) as unknown as FilaPedidoCliente[]).map((p) => ({
      id: p.id,
      canal: p.canal,
      modalidad: p.modalidad,
      metodo_pago: p.metodo_pago,
      estado: p.estado,
      total: p.total,
      costo_domicilio: p.costo_domicilio,
      created_at: p.created_at,
      items: (p.items_pedido ?? []).map((i) => {
        const producto = i.variantes_producto?.productos?.nombre;
        const variante = i.variantes_producto?.nombre;
        const nombre = producto
          ? variante
            ? `${producto} (${variante})`
            : producto
          : (i.nombre_personalizado ?? 'Producto');
        return { nombre, cantidad: i.cantidad };
      }),
    }));
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
    if (cambios.cedula !== undefined) {
      payload.cedula = cambios.cedula.trim() || null;
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
        throw new ConflictException('Ya existe otro cliente con ese teléfono.');
      }
      throw errorDeBase(error);
    }
    this.directorio.invalidar();
    return data;
  }

  /**
   * Pensado para limpiar clientes "inventados" (ej. el cajero cargó
   * "Llevar"/"Mesa" como nombre en el POS en vez de un cliente real).
   * `pedidos.cliente_id` es ON DELETE SET NULL a propósito: el pedido y
   * su venta quedan intactos para informes/reportes, solo se pierde el
   * vínculo al cliente. `movimientos_puntos` sí se borra en cascada,
   * porque el saldo de puntos pertenece al cliente, no al pedido.
   */
  async eliminar(id: string): Promise<void> {
    const { error, count } = await this.supabase
      .getClient()
      .from('clientes')
      .delete({ count: 'exact' })
      .eq('id', id);

    if (error) throw errorDeBase(error);
    if (!count) throw new NotFoundException('Cliente no encontrado.');
    this.directorio.invalidar();
  }
}
