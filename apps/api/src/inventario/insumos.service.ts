import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { MailService } from '../mail/mail.service';
import { errorDeBase } from '../common/error-de-base';
import {
  alertasPorEnviar,
  cambiosDeInsumo,
  filaNuevoInsumo,
  filtrarStockBajo,
  paramsAjusteStock,
  validarAjuste,
  validarCrearInsumo,
  validarEdicionInsumo,
} from './insumos-reglas';
import {
  INSUMO_SELECT,
  STOCK_ALERTA_SELECT,
  type AjusteStockInput,
  type AlertaStockBajo,
  type CrearInsumoInput,
  type EditarInsumoInput,
  type FilaStockInsumo,
  type InsumoDto,
} from './insumos.tipos';

export type * from './insumos.tipos';

const PGRST_SIN_FILAS = 'PGRST116';

@Injectable()
export class InsumosService {
  private readonly logger = new Logger(InsumosService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly mail: MailService,
  ) {}

  async listar(stockBajo?: boolean): Promise<InsumoDto[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('insumos')
      .select(INSUMO_SELECT)
      .order('nombre')
      .returns<InsumoDto[]>();
    if (error) throw errorDeBase(error);

    const insumos = data ?? [];
    return stockBajo ? filtrarStockBajo(insumos) : insumos;
  }

  async crear(input: CrearInsumoInput): Promise<InsumoDto> {
    validarCrearInsumo(input);

    const { data, error } = await this.supabase
      .getClient()
      .from('insumos')
      .insert(filaNuevoInsumo(input))
      .select(INSUMO_SELECT)
      .single<InsumoDto>();
    if (error) throw errorDeBase(error);
    return data;
  }

  async editar(id: string, cambios: EditarInsumoInput): Promise<InsumoDto> {
    validarEdicionInsumo(cambios);

    const { data, error } = await this.supabase
      .getClient()
      .from('insumos')
      .update(cambiosDeInsumo(cambios))
      .eq('id', id)
      .select(INSUMO_SELECT)
      .single<InsumoDto>();
    if (error) {
      if (error.code === PGRST_SIN_FILAS) {
        throw new NotFoundException('Insumo no encontrado.');
      }
      throw errorDeBase(error);
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
    ajuste: AjusteStockInput,
    usuarioId: string,
  ): Promise<InsumoDto> {
    validarAjuste(ajuste);

    const client = this.supabase.getClient();
    const { error: rpcError } = await client.rpc(
      'aplicar_movimientos_stock',
      paramsAjusteStock(insumoId, ajuste, usuarioId),
    );
    if (rpcError) {
      if (rpcError.message?.includes('no existe')) {
        throw new NotFoundException('Insumo no encontrado.');
      }
      throw errorDeBase(rpcError);
    }

    // Fire-and-forget, igual que el resto de los callers de este método —
    // la respuesta del ajuste no debe esperar a que salga un correo.
    this.verificarYAlertarStockBajo([insumoId]).catch((err) =>
      this.logger.error(
        `No se pudo verificar stock bajo tras el ajuste: ${(err as Error).message}`,
      ),
    );

    const { data, error } = await client
      .from('insumos')
      .select(INSUMO_SELECT)
      .eq('id', insumoId)
      .single<InsumoDto>();
    if (error) throw errorDeBase(error);
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
      .select(STOCK_ALERTA_SELECT)
      .in('id', insumoIds)
      .returns<FilaStockInsumo[]>();
    if (error) {
      this.logger.error(`No se pudo verificar stock bajo: ${error.message}`);
      return;
    }

    const { paraAlertar, paraResetear } = alertasPorEnviar(
      data ?? [],
      Date.now(),
    );
    await this.avisar(client, paraAlertar);
    await this.apagarMarcas(client, paraResetear);
  }

  private async avisar(
    client: SupabaseClient,
    alertas: AlertaStockBajo[],
  ): Promise<void> {
    if (alertas.length === 0) return;
    const { error } = await client
      .from('insumos')
      .update({ alerta_stock_enviada_en: new Date().toISOString() })
      .in(
        'id',
        alertas.map((i) => i.id),
      );
    if (error) {
      this.logger.error(
        `No se pudo marcar la alerta de stock enviada: ${error.message}`,
      );
    }
    this.mail.enviarAlertaStockBajo(alertas);
  }

  private async apagarMarcas(
    client: SupabaseClient,
    ids: string[],
  ): Promise<void> {
    if (ids.length === 0) return;
    const { error } = await client
      .from('insumos')
      .update({ alerta_stock_enviada_en: null })
      .in('id', ids);
    if (error) {
      this.logger.error(
        `No se pudo resetear la alerta de stock: ${error.message}`,
      );
    }
  }
}
