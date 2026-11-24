import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ContextoHttp } from '../pedidos/atribucion-web';
import {
  destinoEventosMeta,
  postearEventoMeta,
  type DestinoEventosMeta,
} from '../mensajeria/eventos-meta';
import { payloadEventoWeb, type EventoWebInput } from './eventos-web';

/**
 * Reenvía a la API de conversiones los eventos que el Pixel ya manda desde
 * el navegador, para que lleguen aunque haya bloqueador de anuncios. No se
 * guardan: Meta deduplica contra el Pixel por `event_id`.
 */
@Injectable()
export class EventosWebService {
  private readonly logger = new Logger(EventosWebService.name);
  private readonly destino: DestinoEventosMeta | null;

  constructor(config: ConfigService) {
    this.destino = destinoEventosMeta((clave) => config.get<string>(clave));
  }

  /** Fire-and-forget: el navegador no espera a Meta. */
  registrar(input: EventoWebInput, http: ContextoHttp): void {
    const destino = this.destino;
    if (!destino) return;
    const payload = payloadEventoWeb(input, http, new Date());
    if (!payload) return;
    postearEventoMeta(destino, payload).catch((err: Error) =>
      this.logger.warn(
        `No se pudo enviar ${input.event_name} a Meta: ${err.message}`,
      ),
    );
  }
}
