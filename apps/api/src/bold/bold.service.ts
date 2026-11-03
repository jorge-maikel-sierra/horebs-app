import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENLACE_WHATSAPP_BOT } from '../common/contacto';

const URL_LINKS = 'https://integrations.api.bold.co/online/link/v1';
const MAX_REFERENCIA = 60;
const MIN_DESCRIPCION = 2;
const MAX_DESCRIPCION = 100;
const TIMEOUT_MS = 10_000;
const MAX_LOG = 300;

export interface LinkBold {
  /** `LNK_…`: el mismo valor llega en el webhook como `metadata.reference`. */
  id: string;
  url: string;
}

interface RespuestaCrearLink {
  payload?: { payment_link?: string; url?: string };
  errors?: unknown[];
}

/**
 * Link de pagos de Bold (https://developers.bold.co): un enlace de un solo
 * uso por pedido. Sin `BOLD_API_KEY` el servicio queda apagado y el bot sigue
 * como antes (la tarjeta solo se registra). Las llaves van en Railway, nunca
 * en el repo.
 */
@Injectable()
export class BoldService {
  private readonly logger = new Logger(BoldService.name);

  constructor(private readonly config: ConfigService) {}

  habilitado(): boolean {
    return Boolean(
      this.config.get<string>('BOLD_API_KEY') &&
      this.config.get<string>('BOLD_SECRET_KEY'),
    );
  }

  secreto(): string | undefined {
    return this.config.get<string>('BOLD_SECRET_KEY');
  }

  /**
   * `total` en pesos enteros. Sin `expiration_date` a propósito: la unidad
   * que documenta Bold no es clara (nanosegundos en el texto, milisegundos en
   * los ejemplos) y un valor mal puesto vence el enlace al instante; se
   * agrega tras probarlo en el sandbox.
   */
  async crearLink(datos: {
    referencia: string;
    total: number;
    descripcion: string;
  }): Promise<LinkBold> {
    const llave = this.config.get<string>('BOLD_API_KEY');
    if (!llave)
      throw new ServiceUnavailableException('Bold no está configurado.');

    const respuesta = await fetch(URL_LINKS, {
      method: 'POST',
      headers: {
        Authorization: `x-api-key ${llave}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount_type: 'CLOSE',
        amount: { currency: 'COP', total_amount: datos.total, tip_amount: 0 },
        // Sin esto el botón "Volver a la tienda" de Bold no lleva a ningún lado.
        callback_url: ENLACE_WHATSAPP_BOT,
        reference: datos.referencia.slice(0, MAX_REFERENCIA),
        description: datos.descripcion
          .padEnd(MIN_DESCRIPCION)
          .slice(0, MAX_DESCRIPCION),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const cuerpo = (await respuesta
      .json()
      .catch(() => ({}))) as RespuestaCrearLink;
    const id = cuerpo.payload?.payment_link;
    const url = cuerpo.payload?.url;
    if (!respuesta.ok || !id || !url) {
      this.logger.error(
        `Bold no creó el link (HTTP ${respuesta.status}): ${JSON.stringify(cuerpo.errors ?? cuerpo).slice(0, MAX_LOG)}`,
      );
      throw new ServiceUnavailableException(
        'No se pudo generar el enlace de pago.',
      );
    }
    return { id, url };
  }
}
