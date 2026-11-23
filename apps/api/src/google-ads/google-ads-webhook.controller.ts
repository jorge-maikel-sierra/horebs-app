import {
  BadRequestException,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { GoogleAdsIngestaService } from './google-ads-ingesta.service';
import type { ResultadoLote } from './google-ads.tipos';

/**
 * Lotes del Google Ads Script de la cuenta. Contrato propio, como los
 * webhooks de Meta y Bold: sin @UseGuards (la firma `x-horebs-firma`
 * reemplaza a RolesGuard) y body crudo para verificarla. A diferencia de
 * Bold responde al terminar de guardar, para que el script sepa si debe
 * reintentar. `ContentTypeGuard` exime a /webhooks, por eso el 415 va aquí.
 * Las filas (arreglo anidado) se validan una por una en el service.
 */
@Controller('webhooks')
export class GoogleAdsWebhookController {
  constructor(private readonly ingesta: GoogleAdsIngestaService) {}

  @Post('google-ads')
  @HttpCode(HttpStatus.OK)
  recibir(@Req() req: RawBodyRequest<Request>): Promise<ResultadoLote> {
    if (req.is('json') !== 'json') {
      throw new UnsupportedMediaTypeException(
        'El contenido debe enviarse como application/json.',
      );
    }
    if (!req.rawBody) {
      throw new BadRequestException('Falta el body crudo de la request.');
    }
    const firma = req.headers['x-horebs-firma'] as string | undefined;
    if (!this.ingesta.firmaValida(req.rawBody, firma)) {
      throw new ForbiddenException('Firma inválida.');
    }
    return this.ingesta.recibir(req.body);
  }
}
