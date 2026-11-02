import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ClientesDirectorioService } from './clientes-directorio.service';
import { errorDeBase } from '../common/error-de-base';
import {
  cambiosDeCliente,
  detalleConPedidos,
  filtroDeBusqueda,
  mapPedidoCliente,
  textoDeBusqueda,
  validarEdicionCliente,
} from './clientes-reglas';
import {
  LIMITE_BUSQUEDA,
  LIMITE_LISTADO,
  MAX_PEDIDOS_CLIENTE,
  SELECT_CLIENTE,
  SELECT_CLIENTE_DETALLE,
  SELECT_PEDIDO_CLIENTE,
  type ClienteDetalleDto,
  type ClienteDto,
  type EditarClienteInput,
  type FilaCliente,
  type FilaClienteDetalle,
  type FilaPedidoCliente,
  type FilaPedidoResumen,
  type PedidoClienteDto,
} from './clientes.tipos';

export type * from './clientes.tipos';

const POSTGRES_UNIQUE_VIOLATION = '23505';

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
    const texto = textoDeBusqueda(query);
    if (!texto) return [];

    const { data, error } = await this.supabase
      .getClient()
      .from('clientes')
      .select(SELECT_CLIENTE)
      .or(filtroDeBusqueda(texto))
      .order('nombre')
      .limit(LIMITE_BUSQUEDA)
      .returns<FilaCliente[]>();

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
      .limit(LIMITE_LISTADO)
      .returns<FilaCliente[]>();

    if (error) throw errorDeBase(error);
    return data ?? [];
  }

  async obtenerDetalle(id: string): Promise<ClienteDetalleDto> {
    const client = this.supabase.getClient();
    const { data: cliente, error } = await client
      .from('clientes')
      .select(SELECT_CLIENTE_DETALLE)
      .eq('id', id)
      .single<FilaClienteDetalle>();
    if (error) throw errorDeBase(error);

    const { data: pedidos, error: pedidosError } = await client
      .from('pedidos')
      .select('total, created_at')
      .eq('cliente_id', id)
      .order('created_at', { ascending: false })
      .returns<FilaPedidoResumen[]>();
    if (pedidosError) throw errorDeBase(pedidosError);

    return detalleConPedidos(cliente, pedidos ?? []);
  }

  async listarPedidos(id: string): Promise<PedidoClienteDto[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('pedidos')
      .select(SELECT_PEDIDO_CLIENTE)
      .eq('cliente_id', id)
      .order('created_at', { ascending: false })
      .limit(MAX_PEDIDOS_CLIENTE)
      .returns<FilaPedidoCliente[]>();
    if (error) throw errorDeBase(error);

    return (data ?? []).map(mapPedidoCliente);
  }

  async editar(id: string, cambios: EditarClienteInput): Promise<ClienteDto> {
    validarEdicionCliente(cambios);

    const { data, error } = await this.supabase
      .getClient()
      .from('clientes')
      .update(cambiosDeCliente(cambios))
      .eq('id', id)
      .select(SELECT_CLIENTE)
      .single<FilaCliente>();

    if (error) {
      if (error.code === POSTGRES_UNIQUE_VIOLATION) {
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
