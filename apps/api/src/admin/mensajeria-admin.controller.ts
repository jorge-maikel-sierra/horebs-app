import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CanalMetaPipe } from '../common/pipes/canal-meta.pipe';
import { ValidarBodyPipe } from '../common/pipes/validar-body.pipe';
import { MetaGraphService } from '../mensajeria/meta-graph.service';
import type {
  CanalMeta,
  ResultadoPerfilCanalDto,
} from '../mensajeria/perfil-meta';
import { ESQUEMA_PERFIL_MENSAJERIA } from './esquemas';

@Controller('admin/mensajeria')
@UseGuards(RolesGuard)
export class MensajeriaAdminController {
  constructor(private readonly metaGraph: MetaGraphService) {}

  @Put('perfil/:canal')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async configurarPerfil(
    @Param('canal', CanalMetaPipe) canal: CanalMeta,
    @Body(new ValidarBodyPipe(ESQUEMA_PERFIL_MENSAJERIA))
    _body: Record<string, unknown>,
  ): Promise<ResultadoPerfilCanalDto> {
    void _body;
    await this.metaGraph.configurarPerfil(canal);
    return { ok: true, canal };
  }
}
