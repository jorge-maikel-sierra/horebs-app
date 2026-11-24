import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ValidarBodyPipe } from '../common/pipes/validar-body.pipe';
import { contextoHttp } from '../pedidos/atribucion-web';
import { ESQUEMA_EVENTO_WEB } from './esquemas';
import type { EventoWebInput } from './eventos-web';
import { EventosWebService } from './eventos-web.service';

@Controller('eventos-web')
export class EventosWebController {
  constructor(private readonly eventos: EventosWebService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  registrar(
    @Body(new ValidarBodyPipe(ESQUEMA_EVENTO_WEB)) body: EventoWebInput,
    @Req() req: Request,
  ): void {
    this.eventos.registrar(body, contextoHttp(req));
  }
}
