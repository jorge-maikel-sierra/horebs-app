import type {
  CanalMensajeria,
  DireccionMensaje,
} from './conversaciones.service';
import { idCortoPedido } from '../common/pedido-numero';

export interface DatosAvisoDerivacion {
  canal: CanalMensajeria;
  identificadorExterno: string;
  /** Solo WhatsApp expone el teléfono real (wa_id, ej. 573187592616). */
  telefono: string | null;
  /** Mensajes del pedido actual, en orden — sin los de derivaciones viejas. */
  mensajes: { direccion: DireccionMensaje; texto: string }[];
  /** Presente cuando el bot ya creó el pedido en el sistema (checkout con botones). */
  pedido?: { id: string; total: number; metodoPago: string };
}

export interface AvisoDerivacion {
  asunto: string;
  texto: string;
  html: string;
  textoWhatsapp: string;
}

const URL_PANEL_SEGUIMIENTO = 'https://pizzeriahorebs.shop/admin/seguimiento';
const URL_PANEL_PEDIDOS = 'https://pizzeriahorebs.shop/admin/pedidos';
const INICIO_RESUMEN = '*Resumen de tu pedido*';
const MENSAJES_DE_CONTEXTO = 6;
const LARGO_ULTIMO_MENSAJE_WHATSAPP = 120;

const NARANJA = '#FF6B35';
const AZUL = '#1A3A52';
const AMARILLO = '#FFD93D';

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** "573187592616" → "+57 318 759 2616"; otro formato queda igual. */
function telefonoLegible(waId: string): string {
  const m = /^57(\d{3})(\d{3})(\d{4})$/.exec(waId);
  return m ? `+57 ${m[1]} ${m[2]} ${m[3]}` : `+${waId}`;
}

/** El resumen se manda con formato de WhatsApp (*negrita*): en el correo va limpio. */
function sinFormatoWhatsapp(texto: string): string {
  return texto.replace(/\*(.+?)\*/g, '$1');
}

/** Lo que se extrae una sola vez de la conversación y comparten los tres formatos. */
interface ContextoAviso {
  pedido: DatosAvisoDerivacion['pedido'];
  resumen: string | null;
  nombre: string | null;
  total: string | null;
  ultimoDelCliente: string | null;
  contacto: string;
  linkWhatsapp: string | null;
  quien: string;
  numeroPedido: string | null;
  urlPanel: string;
  /** Los últimos mensajes ya con prefijo "Cliente:" o "Bot:" y sin formato. */
  contexto: string[];
}

function ultimoMensaje(
  mensajes: DatosAvisoDerivacion['mensajes'],
  esDeInteres: (m: DatosAvisoDerivacion['mensajes'][number]) => boolean,
): string | null {
  return [...mensajes].reverse().find(esDeInteres)?.texto ?? null;
}

/** Nombre y total que el código dejó escrito en el resumen del pedido. */
function datosDelResumen(resumen: string | null): {
  nombre: string | null;
  total: string | null;
} {
  if (!resumen) return { nombre: null, total: null };
  return {
    nombre: /^Cliente: (.+)$/m.exec(resumen)?.[1] ?? null,
    total: /\*Total: (\$[\d.]+)\*/.exec(resumen)?.[1] ?? null,
  };
}

function contactoDe(datos: DatosAvisoDerivacion): string {
  return datos.telefono
    ? telefonoLegible(datos.telefono)
    : `${datos.canal} ${datos.identificadorExterno}`;
}

function contextoDelAviso(datos: DatosAvisoDerivacion): ContextoAviso {
  const resumen = ultimoMensaje(
    datos.mensajes,
    (m) => m.direccion === 'saliente_bot' && m.texto.startsWith(INICIO_RESUMEN),
  );
  const { nombre, total } = datosDelResumen(resumen);
  const contacto = contactoDe(datos);
  const pedido = datos.pedido;
  return {
    pedido,
    resumen,
    nombre,
    total,
    ultimoDelCliente: ultimoMensaje(
      datos.mensajes,
      (m) => m.direccion === 'entrante',
    ),
    contacto,
    linkWhatsapp: datos.telefono ? `https://wa.me/${datos.telefono}` : null,
    quien: nombre ?? contacto,
    numeroPedido: pedido ? `#${idCortoPedido(pedido.id)}` : null,
    urlPanel: pedido ? URL_PANEL_PEDIDOS : URL_PANEL_SEGUIMIENTO,
    contexto: datos.mensajes
      .slice(-MENSAJES_DE_CONTEXTO)
      .map(
        (m) =>
          `${m.direccion === 'entrante' ? 'Cliente' : 'Bot'}: ${sinFormatoWhatsapp(m.texto)}`,
      ),
  };
}

function asuntoDelAviso(c: ContextoAviso): string {
  if (!c.pedido) {
    return `🔔 ${c.quien} espera atención${c.total ? ` — pedido de ${c.total}` : ''}`;
  }
  const monto = c.total ?? `$${c.pedido.total.toLocaleString('es-CO')}`;
  return `🛒 Nuevo pedido por WhatsApp ${c.numeroPedido} — ${c.quien} — ${monto}`;
}

function introduccion(c: ContextoAviso): string {
  if (c.pedido) {
    return `Entró un pedido nuevo por WhatsApp (${c.numeroPedido}, pago: ${c.pedido.metodoPago}). Ya está en el panel como pendiente: confirmalo desde ahí y al cliente le llega el aviso.`;
  }
  return c.resumen
    ? 'Un cliente terminó de armar su pedido con el bot y espera que alguien lo confirme.'
    : 'Un cliente pidió hablar con una persona del equipo.';
}

function textoDelAviso(c: ContextoAviso): string {
  return [
    introduccion(c),
    '',
    `Cliente: ${c.quien}`,
    c.nombre ? `Contacto: ${c.contacto}` : null,
    c.linkWhatsapp ? `Escribile: ${c.linkWhatsapp}` : null,
    '',
    c.resumen ? sinFormatoWhatsapp(c.resumen) : null,
    c.ultimoDelCliente
      ? `Último mensaje del cliente: "${c.ultimoDelCliente}"`
      : null,
    '',
    'Últimos mensajes:',
    ...c.contexto,
    '',
    c.pedido
      ? `Pedidos: ${URL_PANEL_PEDIDOS}`
      : `Conversación completa: ${URL_PANEL_SEGUIMIENTO}`,
  ]
    .filter((l) => l !== null)
    .join('\n');
}

function textoWhatsappDelAviso(c: ContextoAviso): string {
  return [
    c.pedido
      ? `🛒 *Nuevo pedido por WhatsApp* ${c.numeroPedido}`
      : '🔔 *Cliente esperando atención*',
    c.nombre ? `${c.nombre} · ${c.contacto}` : c.contacto,
    c.total ? `Pedido: ${c.total}` : 'Pidió hablar con una persona',
    c.ultimoDelCliente
      ? `Último mensaje: "${c.ultimoDelCliente.slice(0, LARGO_ULTIMO_MENSAJE_WHATSAPP)}"`
      : null,
    c.linkWhatsapp ? `Escribile: ${c.linkWhatsapp}` : null,
    `Panel: ${c.urlPanel}`,
  ]
    .filter((l) => l !== null)
    .join('\n');
}

function htmlEncabezado(c: ContextoAviso): string {
  const titulo = c.pedido
    ? `🛒 Nuevo pedido ${c.numeroPedido} — ${escaparHtml(c.quien)}`
    : `🔔 ${escaparHtml(c.quien)} espera atención`;
  return `<tr><td style="background-color:${AZUL};padding:24px 28px;">
            <p style="margin:0;color:${AMARILLO};font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Pizzería Horebs · Bot de WhatsApp</p>
            <h1 style="margin:6px 0 0;color:#ffffff;font-size:20px;">${titulo}</h1>
          </td></tr>
          <tr><td style="padding:24px 28px 0;">
            ${c.nombre ? `<p style="margin:0;font-size:14px;color:${AZUL};">${escaparHtml(c.contacto)}</p>` : ''}
            ${
              c.linkWhatsapp
                ? `<p style="margin:16px 0 0;"><a href="${c.linkWhatsapp}" style="display:inline-block;background-color:${NARANJA};color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:12px 20px;border-radius:8px;">Escribirle por WhatsApp</a></p>`
                : ''
            }
          </td></tr>`;
}

function htmlMensajes(c: ContextoAviso): string {
  const resumen = c.resumen
    ? `<tr><td style="padding:20px 28px 0;">
            <pre style="margin:0;white-space:pre-wrap;font-family:inherit;font-size:14px;color:${AZUL};background-color:#fafafa;border:1px solid #eee;border-radius:8px;padding:14px;">${escaparHtml(sinFormatoWhatsapp(c.resumen))}</pre>
          </td></tr>`
    : '';
  const ultimo = c.ultimoDelCliente
    ? `<tr><td style="padding:16px 28px 0;">
            <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;">Último mensaje del cliente</p>
            <p style="margin:4px 0 0;font-size:14px;color:${AZUL};background-color:#FFF9E6;border-left:3px solid ${AMARILLO};padding:8px 12px;">${escaparHtml(c.ultimoDelCliente)}</p>
          </td></tr>`
    : '';
  const filaContexto = c.contexto
    .map(
      (l) =>
        `<p style="margin:0 0 6px;font-size:13px;color:#555;">${escaparHtml(l)}</p>`,
    )
    .join('');
  return `${resumen}
          ${ultimo}
          <tr><td style="padding:20px 28px 0;">
            <p style="margin:0 0 8px;font-size:12px;color:#888;text-transform:uppercase;">Últimos mensajes</p>
            ${filaContexto}
          </td></tr>`;
}

function htmlDelAviso(c: ContextoAviso): string {
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
          ${htmlEncabezado(c)}
          ${htmlMensajes(c)}
          <tr><td style="padding:16px 28px 24px;">
            <a href="${c.urlPanel}" style="color:${AZUL};font-size:13px;font-weight:600;">${c.pedido ? 'Abrir el pedido en el panel' : 'Ver la conversación completa en el panel'}</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

/**
 * Aviso al equipo cuando el bot deriva una conversación. Todo sale de los
 * mensajes guardados (el resumen lo armó el código, no el modelo), así que
 * el correo nunca trae datos inventados. Correo como canal principal:
 * WhatsApp solo deja mandar texto libre a quien le escribió al bot en las
 * últimas 24h, y el correo no tiene esa ventana.
 */
export function armarAvisoDerivacion(
  datos: DatosAvisoDerivacion,
): AvisoDerivacion {
  const contexto = contextoDelAviso(datos);
  return {
    asunto: asuntoDelAviso(contexto),
    texto: textoDelAviso(contexto),
    html: htmlDelAviso(contexto),
    textoWhatsapp: textoWhatsappDelAviso(contexto),
  };
}
