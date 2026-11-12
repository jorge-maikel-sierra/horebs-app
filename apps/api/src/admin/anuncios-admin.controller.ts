import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { FechaPipe } from '../common/pipes/fecha.pipe';
import {
  AnunciosAdminService,
  type TableroAnunciosDto,
} from './anuncios-admin.service';

@Controller('admin/anuncios')
@UseGuards(RolesGuard)
export class AnunciosAdminController {
  constructor(private readonly anuncios: AnunciosAdminService) {}

  /** `?desde=AAAA-MM-DD` (por defecto, los últimos 30 días). */
  @Get()
  @Roles('admin')
  tablero(
    @Query('desde', new FechaPipe('desde')) desde?: string,
  ): Promise<TableroAnunciosDto> {
    return this.anuncios.tablero(desde);
  }
}
