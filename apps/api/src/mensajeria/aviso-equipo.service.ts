import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { armarAvisoDerivacion } from './aviso-derivacion';
import {
  ConversacionesService,
  type CanalMensajeria,
} from './conversaciones.service';
import { MetaGraphService } from './meta-graph.service';
import { idCortoPedido } from '../common/pedido-numero';
import { pesos } from './resumen-pedido';

const URL_PANEL_PEDIDOS = 'https://pizzeriahorebs.shop/admin/pedidos';

export interface DatosAvisoEquipo {
  canal: CanalMensajeria;
  identificadorExterno: string;
  telefono: string | null;
  conversacionId: string;
  pedido?: { id: string; total: number; metodoPago: string };
  motivo?: string;
}

export interface DatosVentanaCerrada {
  canal: CanalMensajeria;
  identificadorExterno: string;
  telefono: string | null;
  conversacionId?: string;
  pedidoId?: string;
  estadoPedido?: string;
}

export function nombreCanalSocial(canal: CanalMensajeria): string {
  switch (canal) {
    case 'messenger':
      return 'Messenger';
    case 'instagram':
      return 'Instagram';
    default:
      return 'WhatsApp';
  }
}

// Mismo formato que espera el "to" de la Graph API (código de país sin "+",
// ej. 573157861208) — PERSONAL_COCINA_WHATSAPP se carga en formato local
// (3157861208), igual que se muestran los números acá en Colombia.
function formatearNumeroWhatsappCO(numero: string): string {
  const digitos = numero.replace(/\D/g, '');
  return digitos.startsWith('57') ? digitos : `57${digitos}`;
}

// Texto exacto con el que el bot cierra una derivación: marca dónde
// empieza el pedido actual dentro del historial de la conversación.
export const MENSAJE_DERIVACION =
  'Ya avisé al equipo — en breve una persona confirma tu pedido por acá mismo. ¡Gracias por tu paciencia!';

// Inicio fijo de la confirmación de un pedido creado por el checkout del
// bot: también marca el fin de un pedido anterior en el historial.
export const INICIO_CONFIRMACION_PEDIDO = '✅ ¡Listo,';

/**
 * Avisa al equipo — cuando el bot deriva una conversación o cuando crea un
 * pedido — por correo (canal principal, sin ventana de 24h) y por WhatsApp
 * a PERSONAL_COCINA_WHATSAPP (solo llega si ese número le escribió al bot
 * en las últimas 24h). Fire-and-forget: nunca rompe el flujo del cliente.
 */
@Injectable()
export class AvisoEquipoService {
  private readonly logger = new Logger(AvisoEquipoService.name);
  private readonly numerosCocina: string[];

  constructor(
    private readonly config: ConfigService,
    private readonly conversaciones: ConversacionesService,
    private readonly metaGraph: MetaGraphService,
    private readonly mail: MailService,
  ) {
    this.numerosCocina = (
      this.config.get<string>('PERSONAL_COCINA_WHATSAPP') ?? ''
    )
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean)
      .map(formatearNumeroWhatsappCO);
  }

  notificar(datos: DatosAvisoEquipo): void {
    this.avisar(datos).catch((err) =>
      this.logger.error(
        `No se pudo armar el aviso al equipo de ${datos.identificadorExterno}: ${(err as Error).message}`,
      ),
    );
  }

  /**
   * Notifica al equipo que un aviso automático no pudo enviarse por ventana cerrada
   * de 24h en Messenger o Instagram, para que el personal lo atienda a mano.
   */
  notificarVentanaCerrada(datos: DatosVentanaCerrada): void {
    const canalNom = nombreCanalSocial(datos.canal);
    const motivo = `No se pudo notificar al cliente en ${canalNom} por ventana cerrada, escribirle a mano`;
    if (datos.pedidoId && datos.estadoPedido) {
      this.logger.warn(
        `Pedido ${datos.pedidoId} → ${datos.estadoPedido}: ${motivo}.`,
      );
    } else {
      this.logger.warn(motivo);
    }
    this.notificar({
      canal: datos.canal,
      identificadorExterno: datos.identificadorExterno,
      telefono: datos.telefono,
      conversacionId: datos.conversacionId ?? '',
      motivo,
    });
  }

  /** Un pago con tarjeta se acreditó (o falló): correo y WhatsApp a la cocina. */
  notificarPago(datos: {
    pedidoId: string;
    total: number;
    pagado: boolean;
  }): void {
    const codigo = idCortoPedido(datos.pedidoId);
    const estado = datos.pagado ? 'PAGADO con tarjeta' : 'pago RECHAZADO';
    const texto = `Pedido #${codigo} por ${pesos(datos.total)}: ${estado}.`;
    this.mail.enviarAvisoEquipo({
      asunto: `Pedido #${codigo}: ${estado}`,
      texto,
      html: `<p>${texto}</p><p><a href="${URL_PANEL_PEDIDOS}">Ver pedidos</a></p>`,
    });
    this.avisarCocinaPorWhatsapp(texto);
  }

  /** Fire-and-forget: solo llega si ese número le escribió al bot en las últimas 24h. */
  private avisarCocinaPorWhatsapp(texto: string): void {
    for (const numero of this.numerosCocina) {
      this.metaGraph
        .enviarMensajeSesion('whatsapp', numero, texto)
        .catch((err) =>
          this.logger.warn(
            `No se pudo avisar por WhatsApp a ${numero} (¿sin mensajes al bot en 24h?): ${(err as Error).message}`,
          ),
        );
    }
  }

  private async avisar(datos: DatosAvisoEquipo): Promise<void> {
    const mensajes = datos.conversacionId
      ? await this.conversaciones.listarMensajes(datos.conversacionId)
      : [];
    // Solo el pedido actual: lo anterior a la última derivación o al último
    // pedido confirmado ya se atendió. El último mensaje no cuenta como
    // límite — puede ser justo la confirmación de este pedido.
    const ultimaDerivacion = mensajes
      .slice(0, -1)
      .findLastIndex(
        (m) =>
          m.direccion === 'saliente_bot' &&
          (m.texto === MENSAJE_DERIVACION ||
            m.texto.startsWith(INICIO_CONFIRMACION_PEDIDO)),
      );
    const aviso = armarAvisoDerivacion({
      canal: datos.canal,
      identificadorExterno: datos.identificadorExterno,
      telefono: datos.telefono,
      mensajes: mensajes.slice(ultimaDerivacion + 1),
      pedido: datos.pedido,
      motivo: datos.motivo,
    });

    this.mail.enviarAvisoEquipo(aviso);
    this.avisarCocinaPorWhatsapp(aviso.textoWhatsapp);
  }
}
