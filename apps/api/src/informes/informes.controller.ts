import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { InformesService } from './informes.service';
import { FechaPipe } from '../common/pipes/fecha.pipe';

@Controller('informes')
@UseGuards(RolesGuard)
export class InformesController {
  constructor(private readonly informes: InformesService) {}

  @Get()
  @Roles('admin')
  generar(
    @Query('desde', new FechaPipe('desde')) desde?: string,
    @Query('hasta', new FechaPipe('hasta')) hasta?: string,
  ) {
    return this.informes.generar(desde, hasta);
  }
}
