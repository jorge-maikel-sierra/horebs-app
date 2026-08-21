import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { METODOS_PAGO, type MetodoPago } from '../common/metodos-pago';
import { InsumosService } from './insumos.service';

export interface DetalleCompraInput {
  insumo_id?: string;
  producto_comprado: string;
  cantidad: number;
  unidad_medida_compra: 'kg' | 'g';
  valor_unitario: number;
}

export interface CrearCompraInput {
  numero_factura?: string;
  proveedor: string;
  fecha: string;
  otros_cargos?: number;
  metodo_pago: MetodoPago;
  categoria?: string;
  detalle: DetalleCompraInput[];
}

export interface DetalleCompraDto {
  id: string;
  insumo_id: string | null;
  insumo_nombre: string | null;
  producto_comprado: string;
  cantidad: number;
  unidad_medida_compra: 'kg' | 'g';
  valor_unitario: number;
  total_linea: number;
  estado_procesado: 'pendiente' | 'procesado' | 'excluido';
  fecha_procesado: string | null;
}

export interface CompraDto {
  id: string;
  numero_factura: string | null;
  proveedor: string;
  fecha: string;
  subtotal: number;
  otros_cargos: number;
  metodo_pago: string;
  categoria: string | null;
  created_at: string;
  detalle: DetalleCompraDto[];
}

const UNIDADES = ['kg', 'g'];
const COMPRA_SELECT =
  'id, numero_factura, proveedor, fecha, subtotal, otros_cargos, metodo_pago, categoria, created_at, detalle_compra(id, insumo_id, producto_comprado, cantidad, unidad_medida_compra, valor_unitario, total_linea, estado_procesado, fecha_procesado, insumos(nombre))';

@Injectable()
export class ComprasService {
  private readonly logger = new Logger(ComprasService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly insumos: InsumosService,
  ) {}

  async listar(): Promise<CompraDto[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('compras')
      .select(COMPRA_SELECT)
      .order('fecha', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data ?? []).map((c) => this.mapCompra(c));
  }

  async crear(input: CrearCompraInput, registradoPor: string): Promise<CompraDto> {
    if (!input.proveedor?.trim()) {
      throw new BadRequestException('Falta el proveedor.');
    }
    if (!input.fecha) {
      throw new BadRequestException('Falta la fecha de la compra.');
    }
    if (!METODOS_PAGO.includes(input.metodo_pago)) {
      throw new BadRequestException('Método de pago inválido.');
    }
    if (!Array.isArray(input.detalle) || input.detalle.length === 0) {
      throw new BadRequestException('La factura no tiene líneas.');
    }
    for (const linea of input.detalle) {
      if (!linea.producto_comprado?.trim()) {
        throw new BadRequestException('Falta la descripción de una línea.');
      }
      if (typeof linea.cantidad !== 'number' || linea.cantidad <= 0) {
        throw new BadRequestException('Cantidad inválida en una línea.');
      }
      if (!UNIDADES.includes(linea.unidad_medida_compra)) {
        throw new BadRequestException('Unidad de medida inválida en una línea.');
      }
      if (typeof linea.valor_unitario !== 'number' || linea.valor_unitario < 0) {
        throw new BadRequestException('Valor unitario inválido en una línea.');
      }
    }

    // El subtotal nunca se toma del cliente — se recalcula desde las
    // líneas, mismo criterio que calcularItems del checkout público.
    const subtotal = input.detalle.reduce(
      (acc, linea) => acc + linea.cantidad * linea.valor_unitario,
      0,
    );

    const client = this.supabase.getClient();
    const { data: compraId, error: rpcError } = await client.rpc('crear_compra_con_detalle', {
      p_numero_factura: input.numero_factura?.trim() || null,
      p_proveedor: input.proveedor.trim(),
      p_fecha: input.fecha,
      p_subtotal: subtotal,
      p_otros_cargos: input.otros_cargos ?? 0,
      p_metodo_pago: input.metodo_pago,
      p_categoria: input.categoria?.trim() || null,
      p_registrado_por: registradoPor,
      p_detalle: input.detalle.map((linea) => ({
        insumo_id: linea.insumo_id ?? '',
        producto_comprado: linea.producto_comprado.trim(),
        cantidad: linea.cantidad,
        unidad_medida_compra: linea.unidad_medida_compra,
        valor_unitario: linea.valor_unitario,
      })),
    });
    if (rpcError) throw rpcError;

    const { data: creada, error: obtenerError } = await client
      .from('compras')
      .select(COMPRA_SELECT)
      .eq('id', compraId)
      .single();
    if (obtenerError) throw obtenerError;
    return this.mapCompra(creada);
  }

  /** Aplica una línea pendiente al stock del insumo — ver RPC procesar_detalle_compra. */
  async procesarLinea(detalleId: string, procesadoPor: string): Promise<void> {
    const { data, error } = await this.supabase.getClient().rpc('procesar_detalle_compra', {
      p_detalle_id: detalleId,
      p_procesado_por: procesadoPor,
    });
    if (!error && data?.id) {
      // Una compra generalmente saca al insumo de stock bajo, pero se
      // verifica igual por si la cantidad comprada no alcanza a superar
      // el mínimo — y para resetear la alerta cuando sí lo supera.
      this.insumos
        .verificarYAlertarStockBajo([data.id])
        .catch((err) =>
          this.logger.error(`No se pudo verificar stock bajo tras procesar compra: ${(err as Error).message}`),
        );
    }
    if (error) {
      if (error.message?.includes('no existe')) {
        throw new NotFoundException('Línea de compra no encontrada.');
      }
      // El resto de mensajes que arma procesar_detalle_compra() son de negocio
      // (línea no pendiente, sin insumo asignado) y son seguros de mostrar tal
      // cual. Cualquier otro error de Postgres (constraint, tipo, conexión) no
      // se expone crudo al cliente — solo se loguea del lado del servidor.
      if (
        error.message?.includes('no está pendiente') ||
        error.message?.includes('no tiene insumo asignado')
      ) {
        throw new BadRequestException(error.message);
      }
      this.logger.error(`procesar_detalle_compra falló para ${detalleId}: ${error.message}`);
      throw new BadRequestException('No se pudo procesar la línea de compra.');
    }
  }

  async excluirLinea(detalleId: string): Promise<void> {
    const { error, count } = await this.supabase
      .getClient()
      .from('detalle_compra')
      .update({ estado_procesado: 'excluido' }, { count: 'exact' })
      .eq('id', detalleId)
      .eq('estado_procesado', 'pendiente');
    if (error) throw error;
    if (!count) {
      throw new NotFoundException(
        'Línea no encontrada o ya no está pendiente.',
      );
    }
  }

  async vincularInsumo(detalleId: string, insumoId: string): Promise<void> {
    const { error, count } = await this.supabase
      .getClient()
      .from('detalle_compra')
      .update({ insumo_id: insumoId }, { count: 'exact' })
      .eq('id', detalleId)
      .eq('estado_procesado', 'pendiente');
    if (error) throw error;
    if (!count) {
      throw new NotFoundException(
        'Línea no encontrada o ya no está pendiente.',
      );
    }
  }

  private mapCompra(c: any): CompraDto {
    const detalle = (c.detalle_compra ?? []) as any[];
    return {
      id: c.id,
      numero_factura: c.numero_factura,
      proveedor: c.proveedor,
      fecha: c.fecha,
      subtotal: c.subtotal,
      otros_cargos: c.otros_cargos,
      metodo_pago: c.metodo_pago,
      categoria: c.categoria,
      created_at: c.created_at,
      detalle: detalle.map((d) => ({
        id: d.id,
        insumo_id: d.insumo_id,
        insumo_nombre: d.insumos?.nombre ?? null,
        producto_comprado: d.producto_comprado,
        cantidad: d.cantidad,
        unidad_medida_compra: d.unidad_medida_compra,
        valor_unitario: d.valor_unitario,
        total_linea: d.total_linea,
        estado_procesado: d.estado_procesado,
        fecha_procesado: d.fecha_procesado,
      })),
    };
  }
}
