import type {
  CanalMensajeria,
  DireccionMensaje,
} from './conversaciones.service';

export interface DatosAvisoDerivacion {
  canal: CanalMensajeria;
  identificadorExterno: string;
  /** Solo WhatsApp expone el teléfono real (wa_id, ej. 573187592616). */
  telefono: string | null;
  /** Mensajes del pedido actual, en orden — sin los de derivaciones viejas. */
  mensajes: { direccion: DireccionMensaje; texto: string }[];
}

export interface AvisoDerivacion {
  asunto: string;
  texto: string;
  html: string;
  textoWhatsapp: string;
}

const URL_PANEL_SEGUIMIENTO = 'https://pizzeriahorebs.shop/admin/seguimiento';
const INICIO_RESUMEN = '*Resumen de tu pedido*';
const MENSAJES_DE_CONTEXTO = 6;

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
  const resumen =
    [...datos.mensajes]
      .reverse()
      .find(
        (m) =>
          m.direccion === 'saliente_bot' && m.texto.startsWith(INICIO_RESUMEN),
      )?.texto ?? null;
  const nombre = resumen
    ? (/^Cliente: (.+)$/m.exec(resumen)?.[1] ?? null)
    : null;
  const total = resumen
    ? (/\*Total: (\$[\d.]+)\*/.exec(resumen)?.[1] ?? null)
    : null;
  const ultimoDelCliente =
    [...datos.mensajes].reverse().find((m) => m.direccion === 'entrante')
      ?.texto ?? null;

  const contacto = datos.telefono
    ? telefonoLegible(datos.telefono)
    : `${datos.canal} ${datos.identificadorExterno}`;
  const linkWhatsapp = datos.telefono
    ? `https://wa.me/${datos.telefono}`
    : null;
  const quien = nombre ?? contacto;

  const asunto = `🔔 ${quien} espera atención${total ? ` — pedido de ${total}` : ''}`;

  const contexto = datos.mensajes
    .slice(-MENSAJES_DE_CONTEXTO)
    .map(
      (m) =>
        `${m.direccion === 'entrante' ? 'Cliente' : 'Bot'}: ${sinFormatoWhatsapp(m.texto)}`,
    );

  const texto = [
    resumen
      ? 'Un cliente terminó de armar su pedido con el bot y espera que alguien lo confirme.'
      : 'Un cliente pidió hablar con una persona del equipo.',
    '',
    `Cliente: ${quien}`,
    nombre ? `Contacto: ${contacto}` : null,
    linkWhatsapp ? `Escribile: ${linkWhatsapp}` : null,
    '',
    resumen ? sinFormatoWhatsapp(resumen) : null,
    ultimoDelCliente
      ? `Último mensaje del cliente: "${ultimoDelCliente}"`
      : null,
    '',
    'Últimos mensajes:',
    ...contexto,
    '',
    `Conversación completa: ${URL_PANEL_SEGUIMIENTO}`,
  ]
    .filter((l) => l !== null)
    .join('\n');

  const textoWhatsapp = [
    '🔔 *Cliente esperando atención*',
    nombre ? `${nombre} · ${contacto}` : contacto,
    total ? `Pedido: ${total}` : 'Pidió hablar con una persona',
    ultimoDelCliente
      ? `Último mensaje: "${ultimoDelCliente.slice(0, 120)}"`
      : null,
    linkWhatsapp ? `Escribile: ${linkWhatsapp}` : null,
    `Panel: ${URL_PANEL_SEGUIMIENTO}`,
  ]
    .filter((l) => l !== null)
    .join('\n');

  const filaContexto = contexto
    .map(
      (l) =>
        `<p style="margin:0 0 6px;font-size:13px;color:#555;">${escaparHtml(l)}</p>`,
    )
    .join('');

  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
          <tr><td style="background-color:${AZUL};padding:24px 28px;">
            <p style="margin:0;color:${AMARILLO};font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Pizzería Horebs · Bot de WhatsApp</p>
            <h1 style="margin:6px 0 0;color:#ffffff;font-size:20px;">🔔 ${escaparHtml(quien)} espera atención</h1>
          </td></tr>
          <tr><td style="padding:24px 28px 0;">
            ${nombre ? `<p style="margin:0;font-size:14px;color:${AZUL};">${escaparHtml(contacto)}</p>` : ''}
            ${
              linkWhatsapp
                ? `<p style="margin:16px 0 0;"><a href="${linkWhatsapp}" style="display:inline-block;background-color:${NARANJA};color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:12px 20px;border-radius:8px;">Escribirle por WhatsApp</a></p>`
                : ''
            }
          </td></tr>
          ${
            resumen
              ? `<tr><td style="padding:20px 28px 0;">
            <pre style="margin:0;white-space:pre-wrap;font-family:inherit;font-size:14px;color:${AZUL};background-color:#fafafa;border:1px solid #eee;border-radius:8px;padding:14px;">${escaparHtml(sinFormatoWhatsapp(resumen))}</pre>
          </td></tr>`
              : ''
          }
          ${
            ultimoDelCliente
              ? `<tr><td style="padding:16px 28px 0;">
            <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;">Último mensaje del cliente</p>
            <p style="margin:4px 0 0;font-size:14px;color:${AZUL};background-color:#FFF9E6;border-left:3px solid ${AMARILLO};padding:8px 12px;">${escaparHtml(ultimoDelCliente)}</p>
          </td></tr>`
              : ''
          }
          <tr><td style="padding:20px 28px 0;">
            <p style="margin:0 0 8px;font-size:12px;color:#888;text-transform:uppercase;">Últimos mensajes</p>
            ${filaContexto}
          </td></tr>
          <tr><td style="padding:16px 28px 24px;">
            <a href="${URL_PANEL_SEGUIMIENTO}" style="color:${AZUL};font-size:13px;font-weight:600;">Ver la conversación completa en el panel</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { asunto, texto, html, textoWhatsapp };
}
