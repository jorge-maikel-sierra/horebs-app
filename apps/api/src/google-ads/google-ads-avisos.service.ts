import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MailService } from '../mail/mail.service';
import { avisoDeAlertas } from './google-ads-avisos';
import { GoogleAdsTableroService } from './google-ads-tablero.service';

/**
 * 7:00 a.m. en Bogotá (12:00 UTC), una hora después de que el script manda
 * los datos de ayer: si hay alertas críticas o altas, un correo al equipo.
 */
@Injectable()
export class GoogleAdsAvisosService {
  private readonly logger = new Logger(GoogleAdsAvisosService.name);
  private ejecutando = false;

  constructor(
    private readonly tablero: GoogleAdsTableroService,
    private readonly mail: MailService,
  ) {}

  @Cron('0 12 * * *', { name: 'avisar-alertas-google-ads' })
  async avisarCadaDia(): Promise<void> {
    if (this.ejecutando) return;
    this.ejecutando = true;
    try {
      const aviso = avisoDeAlertas(await this.tablero.tablero());
      if (aviso) this.mail.enviarAvisoEquipo(aviso);
    } catch (err) {
      this.logger.error(
        `No se pudieron revisar las alertas de Google Ads: ${(err as Error).message}`,
      );
    } finally {
      this.ejecutando = false;
    }
  }
}
