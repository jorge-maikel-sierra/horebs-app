import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { MailService } from '../mail/mail.service';

export type UnidadMedida = 'g' | 'ml' | 'unidad';

const UNIDADES_MEDIDA: UnidadMedida[] = ['g', 'ml', 'unidad'];

export interface InsumoDto {
  id: string;
  nombre: string;
  categoria: string;
  unidad_medida: UnidadMedida;
  stock_actual_g: number;
  stock_minimo_g: number;
  costo_unitario_g: number;
  proveedor_principal: string | null;
  fecha_ultima_compra: string | null;
  activo: boolean;
}

export interface CrearInsumoInput {
  nombre: string;
  categoria: string;
  unidad_medida?: UnidadMedida;
  stock_minimo_g?: number;
  proveedor_principal?: string;
}

export type TipoAjusteStock = 'ajuste' | 'merma';

const INSUMO_SELECT =
  'id, nombre, categoria, unidad_medida, stock_actual_g, stock_minimo_g, costo_unitario_g, proveedor_principal, fecha_ultima_compra, activo';

// Si ya se avisó por un insumo, no se vuelve a mandar el mismo correo
// hasta que pase este tiempo — evita mandar un mail por cada venta
// mientras el stock siga por debajo del mínimo.
const COOLDOWN_ALERTA_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class InsumosService {
  private readonly logger = new Logger(InsumosService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly mail: MailService,
  ) {}

  async listar(stockBajo?: boolean): Promise<InsumoDto[]> {
    const client = this.supabase.getClient();
    const query = client.from('insumos').select(INSUMO_SELECT).order('nombre');
    const { data, error } = await query;
    if (error) throw error;

    const insumos = data ?? [];
    if (!stockBajo) return insumos;
    return insumos.filter((i) => i.stock_actual_g <= i.stock_minimo_g);
  }

  async crear(input: CrearInsumoInput): Promise<InsumoDto> {
    if (!input.nombre?.trim()) {
      throw new BadRequestException('Falta el nombre del insumo.');
    }
    if (!input.categoria?.trim()) {
      throw new BadRequestException('Falta la categoría del insumo.');
    }
    if (input.unidad_medida !== undefined && !UNIDADES_MEDIDA.includes(input.unidad_medida)) {
      throw new BadRequestException('Unidad de medida inválida.');
    }
    if (input.stock_minimo_g !== undefined && input.stock_minimo_g < 0) {
      throw new BadRequestException('El stock mínimo no puede ser negativo.');
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('insumos')
      .insert({
        nombre: input.nombre.trim(),
        categoria: input.categoria.trim(),
        unidad_medida: input.unidad_medida ?? 'g',
        stock_minimo_g: input.stock_minimo_g ?? 0,
        proveedor_principal: input.proveedor_principal?.trim() || null,
      })
      .select(INSUMO_SELECT)
      .single();
    if (error) throw error;
    return data;
  }

  async editar(
    id: string,
    cambios: {
      nombre?: string;
      categoria?: string;
      unidad_medida?: UnidadMedida;
      stock_minimo_g?: number;
      proveedor_principal?: string;
      activo?: boolean;
    },
  ): Promise<InsumoDto> {
    if (cambios.nombre !== undefined && !cambios.nombre.trim()) {
      throw new BadRequestException('El nombre no puede quedar vacío.');
    }
    if (cambios.unidad_medida !== undefined && !UNIDADES_MEDIDA.includes(cambios.unidad_medida)) {
      throw new BadRequestException('Unidad de medida inválida.');
    }
    if (cambios.stock_minimo_g !== undefined && cambios.stock_minimo_g < 0) {
      throw new BadRequestException('El stock mínimo no puede ser negativo.');
    }

    const payload: Record<string, unknown> = {};
    if (cambios.nombre !== undefined) payload.nombre = cambios.nombre.trim();
    if (cambios.categoria !== undefined) payload.categoria = cambios.categoria.trim();
    if (cambios.unidad_medida !== undefined) payload.unidad_medida = cambios.unidad_medida;
    if (cambios.stock_minimo_g !== undefined) payload.stock_minimo_g = cambios.stock_minimo_g;
    if (cambios.proveedor_principal !== undefined) {
      payload.proveedor_principal = cambios.proveedor_principal.trim() || null;
    }
    if (cambios.activo !== undefined) payload.activo = cambios.activo;

    const { data, error } = await this.supabase
      .getClient()
      .from('insumos')
      .update(payload)
      .eq('id', id)
      .select(INSUMO_SELECT)
      .single();
    if (error) {
      if (error.code === 'PGRST116') throw new NotFoundException('Insumo no encontrado.');
      throw error;
    }
    return data;
  }

  /**
   * Ajuste manual de stock — corrección de conteo físico (tipo 'ajuste',
   * cantidad puede ser positiva o negativa) o pérdida/daño (tipo 'merma',
   * siempre resta). Reusa la misma RPC que ventas/compras para que el
   * movimiento quede en el mismo ledger — nunca se toca stock_actual_g
   * directo desde acá.
   */
  async ajustarStock(
    insumoId: string,
    tipo: TipoAjusteStock,
    cantidad: number,
    motivo: string,
    usuarioId: string,
  ): Promise<InsumoDto> {
    if (!Number.isFinite(cantidad) || cantidad === 0) {
      throw new BadRequestException('La cantidad del ajuste no puede ser cero.');
    }
    if (!motivo?.trim()) {
      throw new BadRequestException('Falta el motivo del ajuste.');
    }
    // La merma siempre resta stock — si alguien pone un número positivo por
    // error, se interpreta igual como salida en vez de fallar en silencio.
    const cantidadFirmada = tipo === 'merma' ? -Math.abs(cantidad) : cantidad;

    const client = this.supabase.getClient();
    const { error: rpcError } = await client.rpc('aplicar_movimientos_stock', {
      p_movimientos: [{ insumo_id: insumoId, cantidad_g: cantidadFirmada }],
      p_referencia_tipo: 'ajuste_manual',
      p_referencia_id: null,
      p_tipo: tipo,
      p_created_by: usuarioId,
      p_motivo: motivo.trim(),
    });
    if (rpcError) {
      if (rpcError.message?.includes('no existe')) {
        throw new NotFoundException('Insumo no encontrado.');
      }
      throw rpcError;
    }

    // Fire-and-forget, igual que el resto de los callers de este método —
    // la respuesta del ajuste no debe esperar a que salga un correo.
    this.verificarYAlertarStockBajo([insumoId]).catch((err) =>
      this.logger.error(`No se pudo verificar stock bajo tras el ajuste: ${(err as Error).message}`),
    );

    const { data, error } = await client
      .from('insumos')
      .select(INSUMO_SELECT)
      .eq('id', insumoId)
      .single();
    if (error) throw error;
    return data;
  }

  /**
   * Revisa el stock de los insumos dados contra su mínimo y manda (o
   * apaga) la alerta por correo. Se llama después de cualquier operación
   * que modifique stock — ventas, compras procesadas, ajustes/merma —
   * para que el aviso salga apenas se cruza el umbral, no en una revisión
   * periódica aparte.
   */
  async verificarYAlertarStockBajo(insumoIds: string[]): Promise<void> {
    if (insumoIds.length === 0) return;
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('insumos')
      .select('id, nombre, unidad_medida, stock_actual_g, stock_minimo_g, alerta_stock_enviada_en')
      .in('id', insumoIds);
    if (error) {
      this.logger.error(`No se pudo verificar stock bajo: ${error.message}`);
      return;
    }

    const ahora = Date.now();
    const paraAlertar: { id: string; nombre: string; unidad: string; stockActual: number; stockMinimo: number }[] = [];
    const paraResetear: string[] = [];

    for (const insumo of data ?? []) {
      const bajoMinimo = insumo.stock_actual_g <= insumo.stock_minimo_g;
      const ultimaAlerta = insumo.alerta_stock_enviada_en
        ? new Date(insumo.alerta_stock_enviada_en).getTime()
        : null;
      const dentroDelCooldown = ultimaAlerta !== null && ahora - ultimaAlerta < COOLDOWN_ALERTA_MS;

      if (bajoMinimo && !dentroDelCooldown) {
        paraAlertar.push({
          id: insumo.id,
          nombre: insumo.nombre,
          unidad: insumo.unidad_medida,
          stockActual: insumo.stock_actual_g,
          stockMinimo: insumo.stock_minimo_g,
        });
      } else if (!bajoMinimo && insumo.alerta_stock_enviada_en) {
        paraResetear.push(insumo.id);
      }
    }

    if (paraAlertar.length > 0) {
      const { error: updateError } = await client
        .from('insumos')
        .update({ alerta_stock_enviada_en: new Date().toISOString() })
        .in(
          'id',
          paraAlertar.map((i) => i.id),
        );
      if (updateError) {
        this.logger.error(`No se pudo marcar la alerta de stock enviada: ${updateError.message}`);
      }
      this.mail.enviarAlertaStockBajo(paraAlertar);
    }

    if (paraResetear.length > 0) {
      const { error: resetError } = await client
        .from('insumos')
        .update({ alerta_stock_enviada_en: null })
        .in('id', paraResetear);
      if (resetError) {
        this.logger.error(`No se pudo resetear la alerta de stock: ${resetError.message}`);
      }
    }
  }
}
