import {
  BadRequestException,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { PagoBoldService } from './pago-bold.service';
import type { EventoBold } from './pago-bold.tipos';

/**
 * Webhook de Bold (ventas por Link de pagos). Contrato propio de Bold, como
 * los de Meta: sin @UseGuards (la firma `x-bold-signature` reemplaza a
 * RolesGuard), body crudo para verificar la firma y respuesta 200 rápida — el
 * procesamiento va aparte y es idempotente, así un reintento de Bold no
 * duplica nada.
 */
@Controller('webhooks')
@SkipThrottle()
export class BoldWebhookController {
  private readonly logger = new Logger(BoldWebhookController.name);

  constructor(private readonly pagos: PagoBoldService) {}

  @Post('bold')
  @HttpCode(HttpStatus.OK)
  recibir(@Req() req: RawBodyRequest<Request>): { ok: boolean } {
    if (!req.rawBody) {
      throw new BadRequestException('Falta el body crudo de la request.');
    }
    const firma = req.headers['x-bold-signature'] as string | undefined;
    if (!this.pagos.firmaValida(req.rawBody, firma)) {
      throw new ForbiddenException('Firma inválida.');
    }
    this.pagos
      .procesarEvento(req.body as EventoBold)
      .catch((err) =>
        this.logger.error(
          `No se pudo procesar el evento de Bold: ${(err as Error).message}`,
        ),
      );
    return { ok: true };
  }
}
