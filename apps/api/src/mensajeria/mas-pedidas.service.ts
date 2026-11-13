import { Injectable, Logger } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { CatalogService, type ProductoDto } from '../catalog/catalog.service';
import { errorDeBase } from '../common/error-de-base';
import { MS_POR_HORA } from '../common/tiempo';
import { SupabaseService } from '../supabase/supabase.service';
import { CANTIDAD_MAS_PEDIDAS, elegirMasPedidas } from './mas-pedidas';

const DIAS_RANKING = 60;

interface FilaRanking {
  producto_id: string;
  pedidos: number;
}

interface RespuestaRanking {
  data: FilaRanking[] | null;
  error: PostgrestError | null;
}

/**
 * Las pizzas más pedidas de los últimos 60 días (función SQL
 * `pizzas_mas_pedidas`). El ranking se guarda una hora en memoria: cambia
 * despacio y se consulta en cada "¿cuánto cuesta?".
 */
@Injectable()
export class MasPedidasService {
  private readonly logger = new Logger(MasPedidasService.name);
  private ranking: { ids: string[]; vence: number } | null = null;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly catalog: CatalogService,
  ) {}

  async pizzas(): Promise<ProductoDto[]> {
    const [ids, productos, categorias] = await Promise.all([
      this.rankingVigente(),
      this.catalog.getProductos(),
      this.catalog.getCategorias(),
    ]);
    return elegirMasPedidas(ids, productos, categorias);
  }

  /** Si la consulta falla, se sigue con el respaldo (ventas históricas y destacadas). */
  private async rankingVigente(): Promise<string[]> {
    if (this.ranking && this.ranking.vence > Date.now()) {
      return this.ranking.ids;
    }
    try {
      const ids = await this.consultarRanking();
      this.ranking = { ids, vence: Date.now() + MS_POR_HORA };
      return ids;
    } catch (err) {
      this.logger.warn(
        `No se pudo leer el ranking de pizzas: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  }

  private async consultarRanking(): Promise<string[]> {
    const respuesta: RespuestaRanking = await this.supabase
      .getClient()
      .rpc('pizzas_mas_pedidas', {
        dias: DIAS_RANKING,
        limite: CANTIDAD_MAS_PEDIDAS,
      });
    if (respuesta.error) throw errorDeBase(respuesta.error);
    return (respuesta.data ?? []).map((f) => f.producto_id);
  }
}
