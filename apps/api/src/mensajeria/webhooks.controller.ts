import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import type {
  MessengerWebhookPayload,
  WhatsappWebhookPayload,
} from './parseo-webhook';
import { WebhooksService } from './webhooks.service';

/**
 * Sin @UseGuards a propósito — mismo patrón que PedidosController y
 * CatalogController (rutas públicas por naturaleza). Meta no manda un
 * Bearer token de usuario: el handshake GET se valida contra
 * META_WEBHOOK_VERIFY_TOKEN y cada POST se verifica por firma HMAC
 * (X-Hub-Signature-256) contra META_APP_SECRET — eso reemplaza a RolesGuard
 * acá.
 *
 * @SkipThrottle — Meta puede mandar ráfagas legítimas de eventos; si el
 * rate limiter global las bloquea, Meta reintenta agresivamente y empeora
 * la carga en vez de aliviarla (mismo criterio que /health).
 */
@Controller('webhooks')
@SkipThrottle()
export class WebhooksController {
  constructor(
    private readonly webhooks: WebhooksService,
    private readonly config: ConfigService,
  ) {}

  @Get('whatsapp')
  verificarWhatsapp(@Query() query: Record<string, string>): string {
    return this.verificarHandshake(query);
  }

  @Get('messenger')
  verificarMessenger(@Query() query: Record<string, string>): string {
    return this.verificarHandshake(query);
  }

  @Get('instagram')
  verificarInstagram(@Query() query: Record<string, string>): string {
    return this.verificarHandshake(query);
  }

  @Post('whatsapp')
  @HttpCode(HttpStatus.OK)
  recibirWhatsapp(@Req() req: RawBodyRequest<Request>): { ok: boolean } {
    this.verificarFirmaOFallar(req);
    this.webhooks.procesarWhatsapp(req.body as WhatsappWebhookPayload);
    return { ok: true };
  }

  @Post('messenger')
  @HttpCode(HttpStatus.OK)
  recibirMessenger(@Req() req: RawBodyRequest<Request>): { ok: boolean } {
    this.verificarFirmaOFallar(req);
    const pageId = this.config.get<string>('MESSENGER_PAGE_ID');
    this.webhooks.procesarMessenger(
      req.body as MessengerWebhookPayload,
      pageId,
    );
    return { ok: true };
  }

  @Post('instagram')
  @HttpCode(HttpStatus.OK)
  recibirInstagram(@Req() req: RawBodyRequest<Request>): { ok: boolean } {
    this.verificarFirmaOFallar(req);
    const igId = this.config.get<string>('INSTAGRAM_ACCOUNT_ID');
    this.webhooks.procesarInstagram(req.body as MessengerWebhookPayload, igId);
    return { ok: true };
  }

  /**
   * hub.mode/hub.verify_token/hub.challenge — Meta lo llama una vez al
   * guardar la configuración del webhook en el App Dashboard.
   */
  private verificarHandshake(query: Record<string, string>): string {
    const verifyToken = this.config.get<string>('META_WEBHOOK_VERIFY_TOKEN');
    const modo = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (modo === 'subscribe' && verifyToken && token === verifyToken) {
      return challenge;
    }
    throw new ForbiddenException('Token de verificación inválido.');
  }

  /**
   * Responder rápido y procesar aparte solo tiene sentido si la firma es
   * válida — si no, se corta acá y `webhooks.service` nunca ve el payload.
   */
  private verificarFirmaOFallar(req: RawBodyRequest<Request>): void {
    const appSecret = this.config.get<string>('META_APP_SECRET');
    if (!appSecret) {
      throw new BadRequestException('META_APP_SECRET no configurado.');
    }
    if (!req.rawBody) {
      throw new BadRequestException('Falta el body crudo de la request.');
    }
    const firmaHeader = req.headers['x-hub-signature-256'] as
      string | undefined;
    const valida = this.webhooks.verificarFirma(
      appSecret,
      req.rawBody,
      firmaHeader,
    );
    if (!valida) {
      throw new ForbiddenException('Firma inválida.');
    }
  }
}
