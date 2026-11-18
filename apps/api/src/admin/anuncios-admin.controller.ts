import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { FechaPipe } from '../common/pipes/fecha.pipe';
import {
  AnunciosAdminService,
  type TableroAnunciosDto,
} from './anuncios-admin.service';
import type { CampanaReciente } from './anuncios-gasto';
import {
  CohortesAdminService,
  type CohortesDto,
} from './cohortes-admin.service';
import {
  AnunciosMetaService,
  type ResultadoSincronizacion,
} from './anuncios-meta.service';

@Controller('admin/anuncios')
@UseGuards(RolesGuard)
export class AnunciosAdminController {
  constructor(
    private readonly anuncios: AnunciosAdminService,
    private readonly meta: AnunciosMetaService,
    private readonly cohortes: CohortesAdminService,
  ) {}

  /** `?desde=AAAA-MM-DD` (por defecto, los últimos 30 días). */
  @Get()
  @Roles('admin')
  tablero(
    @Query('desde', new FechaPipe('desde')) desde?: string,
  ): Promise<TableroAnunciosDto> {
    return this.anuncios.tablero(desde);
  }

  /** Recompra por mes de la primera compra y por campaña; `?desde=AAAA-MM-DD` (por defecto, 90 días). */
  @Get('cohortes')
  @Roles('admin')
  consultarCohortes(
    @Query('desde', new FechaPipe('desde')) desde?: string,
  ): Promise<CohortesDto> {
    return this.cohortes.consultar(desde);
  }

  /** Alimenta el selector de campaña de la caja. */
  @Get('campanas-recientes')
  @Roles('admin', 'empleado')
  campanasRecientes(): Promise<CampanaReciente[]> {
    return this.anuncios.campanasRecientes();
  }

  /** Trae el gasto de Meta ahora mismo (el cron lo hace cada día a las 6:00 a.m.). */
  @Post('sincronizaciones')
  @HttpCode(HttpStatus.OK)
  @Roles('admin')
  sincronizar(
    @Query('desde', new FechaPipe('desde')) desde?: string,
  ): Promise<ResultadoSincronizacion> {
    return this.meta.sincronizar(desde);
  }
}
