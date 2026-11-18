import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  AudienciasMetaService,
  type PanelAudienciasDto,
  type ResultadoAudiencias,
} from './audiencias-meta.service';

@Controller('admin/audiencias')
@UseGuards(RolesGuard)
export class AudienciasAdminController {
  constructor(private readonly audiencias: AudienciasMetaService) {}

  /** Los segmentos de clientes, cuántos entran en cada uno y su público de Meta. */
  @Get()
  @Roles('admin')
  panel(): Promise<PanelAudienciasDto> {
    return this.audiencias.panel();
  }

  /** Refresca los públicos de Meta ahora; apagado mientras no se encienda el interruptor. */
  @Post('sincronizaciones')
  @HttpCode(HttpStatus.OK)
  @Roles('admin')
  sincronizar(): Promise<ResultadoAudiencias> {
    return this.audiencias.sincronizar();
  }
}
