import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { FechaPipe } from '../common/pipes/fecha.pipe';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import { ValidarBodyPipe } from '../common/pipes/validar-body.pipe';
import {
  CostosAdminService,
  type ListaCostosDto,
  type RentabilidadPeriodoDto,
} from './costos-admin.service';
import type { VarianteCostoDto } from './costos-reglas';
import { ESQUEMA_COSTO } from './esquemas';

@Controller('admin/costos')
@UseGuards(RolesGuard)
export class CostosAdminController {
  constructor(private readonly costos: CostosAdminService) {}

  @Get()
  @Roles('admin')
  listar(): Promise<ListaCostosDto> {
    return this.costos.listar();
  }

  /** `?desde=AAAA-MM-DD&hasta=AAAA-MM-DD` (por defecto, los últimos 30 días). */
  @Get('rentabilidad')
  @Roles('admin')
  rentabilidad(
    @Query('desde', new FechaPipe('desde')) desde?: string,
    @Query('hasta', new FechaPipe('hasta')) hasta?: string,
  ): Promise<RentabilidadPeriodoDto> {
    return this.costos.rentabilidad(desde, hasta);
  }

  @Patch('variantes/:id')
  @Roles('admin')
  fijar(
    @Param('id', UuidPipe) id: string,
    @Body(new ValidarBodyPipe(ESQUEMA_COSTO)) body: { costo: number },
  ): Promise<VarianteCostoDto> {
    return this.costos.fijar(id, body.costo);
  }

  @Delete('variantes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('admin')
  async quitar(@Param('id', UuidPipe) id: string): Promise<void> {
    await this.costos.fijar(id, null);
  }
}
