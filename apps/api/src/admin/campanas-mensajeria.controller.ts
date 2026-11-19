import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { FechaPipe } from '../common/pipes/fecha.pipe';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import { ValidarBodyPipe } from '../common/pipes/validar-body.pipe';
import { Ubicacion } from '../common/ubicacion.interceptor';
import {
  CampanasMensajeriaService,
  type ResultadosCampanasDto,
} from './campanas-mensajeria.service';
import type {
  CampanaMensajeriaDto,
  CrearCampanaInput,
  EditarCampanaInput,
  SubidaCreativoDto,
  SubirCreativoInput,
} from './campanas-mensajeria.tipos';
import {
  ESQUEMA_CREAR_CAMPANA_MENSAJERIA,
  ESQUEMA_EDITAR_CAMPANA_MENSAJERIA,
  ESQUEMA_SUBIR_CREATIVO,
} from './esquemas';

@Controller('admin/campanas-mensajeria')
@UseGuards(RolesGuard)
export class CampanasMensajeriaController {
  constructor(private readonly campanas: CampanasMensajeriaService) {}

  /** `?activas=true` alimenta el selector de campaña de la caja. */
  @Get()
  @Roles('admin', 'empleado')
  listar(
    @Query('activas', new ParseBoolPipe({ optional: true })) activas?: boolean,
  ): Promise<CampanaMensajeriaDto[]> {
    return this.campanas.listar(activas ?? false);
  }

  /** `?desde=AAAA-MM-DD` por día de envío (por defecto, los últimos 90 días). */
  @Get('resultados')
  @Roles('admin')
  resultados(
    @Query('desde', new FechaPipe('desde')) desde?: string,
  ): Promise<ResultadosCampanasDto> {
    return this.campanas.resultados(desde);
  }

  @Get(':id')
  @Roles('admin')
  obtener(@Param('id', UuidPipe) id: string): Promise<CampanaMensajeriaDto> {
    return this.campanas.obtener(id);
  }

  @Post()
  @Roles('admin')
  @Ubicacion('/admin/campanas-mensajeria/:id')
  crear(
    @Body(new ValidarBodyPipe(ESQUEMA_CREAR_CAMPANA_MENSAJERIA))
    body: CrearCampanaInput,
  ): Promise<CampanaMensajeriaDto> {
    return this.campanas.crear(body);
  }

  @Patch(':id')
  @Roles('admin')
  editar(
    @Param('id', UuidPipe) id: string,
    @Body(new ValidarBodyPipe(ESQUEMA_EDITAR_CAMPANA_MENSAJERIA))
    body: EditarCampanaInput,
  ): Promise<CampanaMensajeriaDto> {
    return this.campanas.editar(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('admin')
  eliminar(@Param('id', UuidPipe) id: string): Promise<void> {
    return this.campanas.eliminar(id);
  }

  /** Devuelve la URL firmada para subir el creativo; no crea un recurso con GET propio. */
  @Post(':id/creativos')
  @HttpCode(HttpStatus.OK)
  @Roles('admin')
  prepararCreativo(
    @Param('id', UuidPipe) id: string,
    @Body(new ValidarBodyPipe(ESQUEMA_SUBIR_CREATIVO))
    body: SubirCreativoInput,
  ): Promise<SubidaCreativoDto> {
    return this.campanas.prepararCreativo(id, body);
  }
}
