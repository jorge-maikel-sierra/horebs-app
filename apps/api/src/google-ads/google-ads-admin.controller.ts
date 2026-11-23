import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { FechaPipe } from '../common/pipes/fecha.pipe';
import type { TableroGoogleAdsDto } from './google-ads-tablero';
import {
  GoogleAdsTableroService,
  type CampanaCaja,
} from './google-ads-tablero.service';

@Controller('admin/google-ads')
@UseGuards(RolesGuard)
export class GoogleAdsAdminController {
  constructor(private readonly tableroAds: GoogleAdsTableroService) {}

  /** `?desde=&hasta=` (AAAA-MM-DD); por defecto, los 28 días hasta ayer. */
  @Get()
  @Roles('admin')
  tablero(
    @Query('desde', new FechaPipe('desde')) desde?: string,
    @Query('hasta', new FechaPipe('hasta')) hasta?: string,
  ): Promise<TableroGoogleAdsDto> {
    return this.tableroAds.tablero(desde, hasta);
  }

  /** Alimenta el selector de campaña de la caja (prefijo `gads:` al guardar). */
  @Get('campanas')
  @Roles('admin', 'empleado')
  campanas(): Promise<CampanaCaja[]> {
    return this.tableroAds.campanasActivas();
  }
}
