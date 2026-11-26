import { ENLACE_RESENA_GOOGLE } from '../common/contacto';
import { escaparHtml } from '../common/escapar-html';
import { idCortoPedido } from '../common/pedido-numero';

/** Correo al cliente web cuando se entrega su pedido: le pide la reseña en Google. */

export interface InvitacionResena {
  nombre: string;
  pedidoId: string;
}

export interface CorreoArmado {
  subject: string;
  text: string;
  html: string;
}

const NARANJA = '#FF6B35';
const AZUL = '#1A3A52';

export function correoInvitacionResena(datos: InvitacionResena): CorreoArmado {
  const numero = `#${idCortoPedido(datos.pedidoId)}`;
  const nombre = datos.nombre.trim();
  const saludo = nombre ? `¡Hola, ${nombre}!` : '¡Hola!';
  return {
    subject: `🍕 Tu pedido ${numero} ya llegó — ¿qué tal estuvo?`,
    text: [
      saludo,
      '',
      `Tu pedido ${numero} de Pizzería Horebs ya fue entregado. ¡Que lo disfrutes!`,
      '',
      'Si te gustó, nos ayudas mucho con tu reseña en Google (toma menos de un minuto):',
      ENLACE_RESENA_GOOGLE,
      '',
      'Gracias por pedirnos.',
    ].join('\n'),
    html: `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:24px 0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;padding:28px;color:${AZUL};">
            <tr><td style="font-size:20px;font-weight:700;">${escaparHtml(saludo)}</td></tr>
            <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;">Tu pedido <strong>${numero}</strong> de Pizzería Horebs ya fue entregado. ¡Que lo disfrutes! 🍕</td></tr>
            <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;">Si te gustó, nos ayudas mucho con tu reseña en Google. Toma menos de un minuto.</td></tr>
            <tr><td align="center" style="padding-top:24px;"><a href="${ENLACE_RESENA_GOOGLE}" style="display:inline-block;background-color:${NARANJA};color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:999px;">⭐ Dejar mi reseña</a></td></tr>
            <tr><td style="padding-top:24px;font-size:13px;color:#71717a;">Gracias por pedirnos.</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  };
}
