import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { errorDeBase } from '../common/error-de-base';
import { SupabaseService } from '../supabase/supabase.service';
import {
  clasificarErrorProcesado,
  mapCompra,
  paramsCrearCompra,
  subtotalDeCompra,
  validarCompra,
} from './compras-reglas';
import {
  COMPRA_SELECT,
  type ActualizarLineaInput,
  type CompraDto,
  type CrearCompraInput,
  type FilaCompra,
} from './compras.tipos';
import { InsumosService } from './insumos.service';

const LINEA_NO_PENDIENTE = 'Línea no encontrada o ya no está pendiente.';

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
      .limit(100)
      .returns<FilaCompra[]>();
    if (error) throw errorDeBase(error);
    return data.map(mapCompra);
  }

  async crear(
    input: CrearCompraInput,
    registradoPor: string,
  ): Promise<CompraDto> {
    validarCompra(input);
    const client = this.supabase.getClient();

    const respuesta = await client.rpc(
      'crear_compra_con_detalle',
      paramsCrearCompra(input, subtotalDeCompra(input.detalle), registradoPor),
    );
    if (respuesta.error) throw errorDeBase(respuesta.error);

    const { data: creada, error } = await client
      .from('compras')
      .select(COMPRA_SELECT)
      .eq('id', respuesta.data as string)
      .single<FilaCompra>();
    if (error) throw errorDeBase(error);
    return mapCompra(creada);
  }

  /**
   * Una sola operación para las tres acciones sobre una línea: vincular un
   * insumo y/o pasarla a procesada o excluida. Si vienen las dos, primero se
   * vincula (procesar necesita el insumo).
   */
  async actualizarLinea(
    detalleId: string,
    cambios: ActualizarLineaInput,
    usuarioId: string,
  ): Promise<void> {
    if (!cambios.estado && !cambios.insumo_id) {
      throw new BadRequestException(
        'Indica el insumo a vincular o el estado a aplicar.',
      );
    }
    if (cambios.insumo_id) {
      await this.vincularInsumo(detalleId, cambios.insumo_id);
    }
    if (cambios.estado === 'procesado') {
      await this.procesarLinea(detalleId, usuarioId);
    }
    if (cambios.estado === 'excluido') {
      await this.excluirLinea(detalleId);
    }
  }

  /** Aplica una línea pendiente al stock del insumo (RPC `procesar_detalle_compra`). */
  async procesarLinea(detalleId: string, procesadoPor: string): Promise<void> {
    const respuesta = await this.supabase
      .getClient()
      .rpc('procesar_detalle_compra', {
        p_detalle_id: detalleId,
        p_procesado_por: procesadoPor,
      });
    if (respuesta.error) {
      this.lanzarErrorDeProcesado(detalleId, respuesta.error);
    }
    this.alertarStockBajo((respuesta.data as { id?: string } | null)?.id);
  }

  async excluirLinea(detalleId: string): Promise<void> {
    await this.actualizarLineaPendiente(detalleId, {
      estado_procesado: 'excluido',
    });
  }

  async vincularInsumo(detalleId: string, insumoId: string): Promise<void> {
    await this.actualizarLineaPendiente(detalleId, { insumo_id: insumoId });
  }

  /** Solo una línea pendiente se puede cambiar; si no hay ninguna, es un 404. */
  private async actualizarLineaPendiente(
    detalleId: string,
    cambios: { estado_procesado: 'excluido' } | { insumo_id: string },
  ): Promise<void> {
    const { error, count } = await this.supabase
      .getClient()
      .from('detalle_compra')
      .update(cambios, { count: 'exact' })
      .eq('id', detalleId)
      .eq('estado_procesado', 'pendiente');
    if (error) throw errorDeBase(error);
    if (!count) throw new NotFoundException(LINEA_NO_PENDIENTE);
  }

  private lanzarErrorDeProcesado(
    detalleId: string,
    error: { message: string },
  ): never {
    const clase = clasificarErrorProcesado(error.message);
    if (clase === 'no_existe') {
      throw new NotFoundException('Línea de compra no encontrada.');
    }
    if (clase === 'conflicto') throw new ConflictException(error.message);
    if (clase === 'de_negocio') throw new BadRequestException(error.message);
    this.logger.error(
      `procesar_detalle_compra falló para ${detalleId}: ${error.message}`,
    );
    throw errorDeBase(error);
  }

  /**
   * Una compra generalmente saca al insumo de stock bajo, pero se verifica
   * igual por si la cantidad comprada no alcanza a superar el mínimo, y para
   * resetear la alerta cuando sí lo supera. Fire-and-forget.
   */
  private alertarStockBajo(insumoId: string | undefined): void {
    if (!insumoId) return;
    this.insumos
      .verificarYAlertarStockBajo([insumoId])
      .catch((err: Error) =>
        this.logger.error(
          `No se pudo verificar stock bajo tras procesar compra: ${err.message}`,
        ),
      );
  }
}
