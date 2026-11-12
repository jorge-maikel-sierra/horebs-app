import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { contextoHttp } from './atribucion-web';
import { PedidosService } from './pedidos.service';
import type { CrearPedidoInput, PedidoDto } from './pedidos.tipos';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import { Ubicacion } from '../common/ubicacion.interceptor';

@Controller('pedidos')
export class PedidosController {
  constructor(private readonly pedidos: PedidosService) {}

  // Sin ValidarBodyPipe: el body trae `items[]` y `cliente` anidados, que se
  // validan en `validar-pedido.ts` y `calcular-items.ts`.
  @Post()
  @Ubicacion('/pedidos/:id')
  crear(
    @Body() body: CrearPedidoInput,
    @Req() req: Request,
  ): Promise<PedidoDto> {
    return this.pedidos.crear(body, contextoHttp(req));
  }

  @Get(':id')
  obtener(@Param('id', UuidPipe) id: string): Promise<PedidoDto> {
    return this.pedidos.obtener(id);
  }
}
