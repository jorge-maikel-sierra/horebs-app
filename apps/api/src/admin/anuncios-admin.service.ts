import { Injectable } from '@nestjs/common';
import { errorDeBase } from '../common/error-de-base';
import { inicioDiaBogota } from '../common/horario';
import { SupabaseService } from '../supabase/supabase.service';
import {
  DIAS_TABLERO_DEFECTO,
  fechaHaceDias,
  rendimientoPorOrigen,
  type FilaConversacionOrigen,
  type FilaPedidoOrigen,
  type RendimientoOrigenDto,
} from './anuncios-reglas';

export interface TableroAnunciosDto {
  desde: string;
  origenes: RendimientoOrigenDto[];
}

/** Ventas y conversaciones por anuncio o enlace con `ref` (bot de Meta). */
@Injectable()
export class AnunciosAdminService {
  constructor(private readonly supabase: SupabaseService) {}

  async tablero(desde?: string): Promise<TableroAnunciosDto> {
    const dia = desde ?? fechaHaceDias(DIAS_TABLERO_DEFECTO);
    const inicio = inicioDiaBogota(dia);
    const client = this.supabase.getClient();

    const [conversaciones, pedidos] = await Promise.all([
      client
        .from('conversaciones_bot')
        .select('origen_fuente, origen_anuncio_id, origen_ref, origen_titulo')
        .gte('origen_capturado_en', inicio)
        .returns<FilaConversacionOrigen[]>(),
      client
        .from('pedidos')
        .select('origen_fuente, origen_anuncio_id, origen_ref, total, estado')
        .not('origen_fuente', 'is', null)
        .gte('created_at', inicio)
        .returns<FilaPedidoOrigen[]>(),
    ]);
    if (conversaciones.error) throw errorDeBase(conversaciones.error);
    if (pedidos.error) throw errorDeBase(pedidos.error);

    return {
      desde: dia,
      origenes: rendimientoPorOrigen(
        conversaciones.data ?? [],
        pedidos.data ?? [],
      ),
    };
  }
}
