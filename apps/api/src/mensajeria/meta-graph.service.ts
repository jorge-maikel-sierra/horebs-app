import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { obtenerCapacidades, partirTextoPorBytes } from './capacidades-canal';
import type { CanalMensajeria } from './conversaciones.service';
import {
  interactivoBotonCatalogo,
  interactivoBotones,
  interactivoCatalogo,
  interactivoLista,
  interactivoListaProductos,
  interactivoTarjetaProducto,
  normalizarNegritaWhatsapp,
  recortarListaProductos,
  textoTarjetasProductos,
  type BotonRespuesta,
  type Interactivo,
  type ListaProductos,
  type TarjetaProducto,
} from './mensajes-interactivos';
import {
  armarGenericTemplateSocial,
  armarQuickRepliesSocial,
  armarSenderActionSocial,
  armarTextoSocial,
  elementosDeTarjetas,
  esErrorBusinessAi,
} from './mensajes-meta-social';
import { descargarMediaUrlDirecta, descargarMediaWhatsapp } from './meta-media';
import { ErrorGraphPermanente, errorDeGraph } from './graph-errores';
import { enviarPerfilMeta } from './perfil-meta';

const REINTENTOS = 2;
const ESPERA_PRIMER_REINTENTO_MS = 500;
const ESPERA_SEGUNDO_REINTENTO_MS = 1500;
const BACKOFF_MS = [ESPERA_PRIMER_REINTENTO_MS, ESPERA_SEGUNDO_REINTENTO_MS];

@Injectable()
export class MetaGraphService {
  private readonly logger = new Logger(MetaGraphService.name);
  private readonly version: string;
  private readonly whatsappToken?: string;
  private readonly whatsappPhoneNumberId?: string;
  private readonly pageToken?: string;
  private readonly pageId?: string;
  private readonly instagramAccountId?: string;
  private readonly whatsappCatalogId?: string;

  constructor(private readonly config: ConfigService) {
    this.version = this.config.get<string>('META_GRAPH_API_VERSION') ?? 'v21.0';
    this.whatsappToken = this.config.get<string>('WHATSAPP_ACCESS_TOKEN');
    this.whatsappPhoneNumberId = this.config.get<string>(
      'WHATSAPP_PHONE_NUMBER_ID',
    );
    this.whatsappCatalogId = this.config.get<string>('WHATSAPP_CATALOG_ID');
    this.pageToken = this.config.get<string>('MESSENGER_PAGE_ACCESS_TOKEN');
    this.pageId = this.config.get<string>('MESSENGER_PAGE_ID');
    this.instagramAccountId = this.config.get<string>('INSTAGRAM_ACCOUNT_ID');

    if (!this.whatsappToken || !this.whatsappPhoneNumberId) {
      this.logger.warn(
        'WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_NUMBER_ID no configuradas — WhatsApp no puede enviar mensajes.',
      );
    }
    if (!this.pageToken || !this.pageId) {
      this.logger.warn(
        'MESSENGER_PAGE_ACCESS_TOKEN o MESSENGER_PAGE_ID no configuradas — Messenger e Instagram no pueden enviar mensajes.',
      );
    }
  }

  marcarLeidoEscribiendo(
    canal: CanalMensajeria,
    destinatarioId: string,
    mensajeId?: string,
  ): void {
    if (canal === 'whatsapp') {
      if (!mensajeId || !this.whatsappToken || !this.whatsappPhoneNumberId)
        return;
      this.postWhatsapp({
        status: 'read',
        message_id: mensajeId,
        typing_indicator: { type: 'text' },
      }).catch((err: Error) =>
        this.logger.warn(
          `No se pudo marcar leído/escribiendo ${mensajeId}: ${err.message}`,
        ),
      );
      return;
    }
    if (!this.pageToken || !this.pageId) return;
    this.postSocial(armarSenderActionSocial(destinatarioId, 'mark_seen')).catch(
      () => undefined,
    );
    this.postSocial(armarSenderActionSocial(destinatarioId, 'typing_on')).catch(
      () => undefined,
    );
  }

  async enviarBotones(
    canal: CanalMensajeria,
    destinatarioId: string,
    cuerpo: string,
    botones: BotonRespuesta[],
  ): Promise<void> {
    if (canal === 'whatsapp') {
      await this.enviarInteractivo(
        destinatarioId,
        interactivoBotones(cuerpo, botones),
      );
      return;
    }
    await this.conReintentos(() =>
      this.postSocial(armarQuickRepliesSocial(destinatarioId, cuerpo, botones)),
    );
  }

  async enviarLista(
    canal: CanalMensajeria,
    destinatarioId: string,
    datos: { cuerpo: string; boton: string; filas: BotonRespuesta[] },
  ): Promise<void> {
    if (canal === 'whatsapp') {
      await this.enviarInteractivo(destinatarioId, interactivoLista(datos));
      return;
    }
    await this.conReintentos(() =>
      this.postSocial(
        armarQuickRepliesSocial(destinatarioId, datos.cuerpo, datos.filas),
      ),
    );
  }

  descargarMedia(mediaId: string): Promise<{ datos: Buffer; mime: string }> {
    if (mediaId.startsWith('http://') || mediaId.startsWith('https://')) {
      return descargarMediaUrlDirecta(mediaId);
    }
    if (!this.whatsappToken) {
      throw new ServiceUnavailableException('WhatsApp no está configurado.');
    }
    return descargarMediaWhatsapp(this.version, this.whatsappToken, mediaId);
  }

  async enviarMensajeSesion(
    canal: CanalMensajeria,
    destinatarioId: string,
    texto: string,
  ): Promise<void> {
    if (canal === 'whatsapp') {
      const textoNormalizado = normalizarNegritaWhatsapp(texto);
      await this.conReintentos(() =>
        this.postWhatsapp({
          to: destinatarioId,
          type: 'text',
          text: { body: textoNormalizado },
        }),
      );
      return;
    }
    const capacidades = obtenerCapacidades(canal);
    const partes = partirTextoPorBytes(texto, capacidades.maxBytesTexto);
    for (const parte of partes) {
      await this.conReintentos(() =>
        this.postSocial(armarTextoSocial(destinatarioId, parte)),
      );
    }
  }

  async enviarCatalogo(
    canal: CanalMensajeria,
    destinatarioId: string,
    urlFallback: string,
    miniaturaRetailerId?: string,
  ): Promise<'catalogo' | 'link'> {
    if (canal !== 'whatsapp' || !this.whatsappCatalogId) {
      await this.enviarBotonCatalogo(canal, destinatarioId, urlFallback);
      return 'link';
    }
    try {
      await this.enviarInteractivo(
        destinatarioId,
        interactivoCatalogo(miniaturaRetailerId),
      );
      return 'catalogo';
    } catch (err) {
      this.logger.warn(
        `catalog_message rechazado, se manda el link: ${(err as Error).message}`,
      );
      await this.enviarBotonCatalogo(canal, destinatarioId, urlFallback);
      return 'link';
    }
  }

  async enviarListaProductos(
    canal: CanalMensajeria,
    destinatarioId: string,
    lista: ListaProductos,
    tarjetasFallback: TarjetaProducto[],
  ): Promise<'lista' | 'tarjetas'> {
    const recortada = recortarListaProductos(lista);
    const catalogId = this.whatsappCatalogId;
    if (
      canal !== 'whatsapp' ||
      !catalogId ||
      recortada.secciones.length === 0
    ) {
      await this.enviarTarjetasProductos(
        canal,
        destinatarioId,
        tarjetasFallback,
      );
      return 'tarjetas';
    }
    try {
      await this.enviarInteractivo(
        destinatarioId,
        interactivoListaProductos(recortada, catalogId),
      );
      return 'lista';
    } catch (err) {
      this.logger.warn(
        `product_list rechazado, se mandan tarjetas: ${(err as Error).message}`,
      );
      await this.enviarTarjetasProductos(
        canal,
        destinatarioId,
        tarjetasFallback,
      );
      return 'tarjetas';
    }
  }

  async enviarBotonCatalogo(
    canal: CanalMensajeria,
    destinatarioId: string,
    url: string,
  ): Promise<void> {
    if (canal !== 'whatsapp') {
      await this.enviarMensajeSesion(
        canal,
        destinatarioId,
        `Mira nuestro catálogo completo con fotos y precios aquí: ${url}`,
      );
      return;
    }
    await this.enviarInteractivo(destinatarioId, interactivoBotonCatalogo(url));
  }

  async enviarTarjetasProductos(
    canal: CanalMensajeria,
    destinatarioId: string,
    productos: TarjetaProducto[],
  ): Promise<void> {
    if (canal === 'whatsapp') {
      for (const producto of productos) {
        await this.enviarInteractivo(
          destinatarioId,
          interactivoTarjetaProducto(producto),
        );
      }
      return;
    }
    if (canal === 'instagram') {
      await this.enviarMensajeSesion(
        canal,
        destinatarioId,
        textoTarjetasProductos(productos),
      );
    }
    await this.conReintentos(() =>
      this.postSocial(
        armarGenericTemplateSocial(
          destinatarioId,
          elementosDeTarjetas(productos),
        ),
      ),
    );
  }

  async configurarPerfil(canal: 'messenger' | 'instagram'): Promise<void> {
    if (!this.pageToken) {
      throw new ServiceUnavailableException(
        'MESSENGER_PAGE_ACCESS_TOKEN no configurada.',
      );
    }
    await enviarPerfilMeta(this.version, this.pageToken, canal);
    this.logger.log(`Perfil de ${canal} configurado exitosamente en Meta.`);
  }

  private enviarInteractivo(
    destinatarioId: string,
    interactive: Interactivo,
  ): Promise<void> {
    return this.conReintentos(() =>
      this.postWhatsapp({
        to: destinatarioId,
        type: 'interactive',
        interactive,
      }),
    );
  }

  private async postWhatsapp(cuerpo: Record<string, unknown>): Promise<void> {
    if (!this.whatsappToken || !this.whatsappPhoneNumberId) {
      throw new ServiceUnavailableException('WhatsApp no está configurado.');
    }
    const res = await fetch(
      `https://graph.facebook.com/${this.version}/${this.whatsappPhoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.whatsappToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messaging_product: 'whatsapp', ...cuerpo }),
      },
    );
    if (!res.ok) {
      const detalle = await res.text().catch(() => '');
      throw errorDeGraph(
        res.status,
        `WhatsApp Graph API respondió ${res.status}: ${detalle}`,
      );
    }
  }

  private async postSocial(cuerpo: Record<string, unknown>): Promise<void> {
    if (!this.pageToken || !this.pageId) {
      throw new ServiceUnavailableException(
        'Messenger/Instagram no están configurados.',
      );
    }
    const res = await fetch(
      `https://graph.facebook.com/${this.version}/${this.pageId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.pageToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cuerpo),
      },
    );
    if (!res.ok) {
      const textoError = await res.text().catch(() => '');
      let errorJson: unknown;
      try {
        errorJson = JSON.parse(textoError);
      } catch {
        errorJson = null;
      }
      if (esErrorBusinessAi(errorJson)) {
        this.logger.warn(
          `Business AI tomó el control en Messenger/Instagram — no se reintenta: ${textoError}`,
        );
        return;
      }
      throw errorDeGraph(
        res.status,
        `Messenger/Instagram Graph API respondió ${res.status}: ${textoError}`,
      );
    }
  }

  private async conReintentos(accion: () => Promise<void>): Promise<void> {
    let ultimoError: unknown;
    for (let intento = 0; intento <= REINTENTOS; intento++) {
      try {
        await accion();
        return;
      } catch (err) {
        ultimoError = err;
        if (err instanceof ErrorGraphPermanente) break;
        if (intento < REINTENTOS) {
          await new Promise((resolve) =>
            // eslint-disable-next-line security/detect-object-injection
            setTimeout(resolve, BACKOFF_MS[intento]),
          );
        }
      }
    }
    this.logger.error(`Falló el envío: ${(ultimoError as Error).message}`);
    throw ultimoError;
  }
}
