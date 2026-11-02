import { Injectable, type PipeTransform } from '@nestjs/common';
import { FechaPipe } from '../common/pipes/fecha.pipe';
import { LimitePipe } from '../common/pipes/limite.pipe';
import { UuidOpcionalPipe } from '../common/pipes/uuid.pipe';
import { MAX_LIMITE, type FiltrosMovimientos } from './movimientos.tipos';

type QueryCruda = Partial<Record<keyof FiltrosMovimientos, string>>;

const FECHA_DESDE = new FechaPipe('desde');
const FECHA_HASTA = new FechaPipe('hasta');
const LIMITE = new LimitePipe(MAX_LIMITE);

/** Valida el query de `GET /inventario/movimientos` con los pipes de cada parámetro. */
@Injectable()
export class ConsultaMovimientosPipe implements PipeTransform<
  QueryCruda,
  Promise<FiltrosMovimientos>
> {
  async transform(query: QueryCruda): Promise<FiltrosMovimientos> {
    return {
      // `optional: true` deja pasar un valor ausente, aunque el tipo diga string.
      insumoId: await UuidOpcionalPipe.transform(query.insumoId as string, {
        type: 'query',
      }),
      tipo: query.tipo,
      desde: FECHA_DESDE.transform(query.desde),
      hasta: FECHA_HASTA.transform(query.hasta),
      limit: LIMITE.transform(query.limit),
    };
  }
}
