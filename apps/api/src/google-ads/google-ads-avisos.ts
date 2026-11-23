import { escaparHtml } from '../common/escapar-html';
import type { AlertaDto } from './google-ads-alertas';
import type { TableroGoogleAdsDto } from './google-ads-tablero';

/** Correo diario al equipo con las alertas que piden acción ya (puro). */

export const URL_TABLERO_GOOGLE_ADS =
  'https://pizzeriahorebs.shop/admin/google-ads';
const SEVERIDADES_AVISO: AlertaDto['severidad'][] = ['critica', 'alta'];

export interface AvisoCorreo {
  asunto: string;
  texto: string;
  html: string;
}

/**
 * Solo críticas y altas. Mientras el script nunca haya enviado datos no se
 * avisa "datos viejos": no es una falla, es que aún no se instala.
 */
export function alertasParaAvisar(t: TableroGoogleAdsDto): AlertaDto[] {
  const nuncaConectado = t.sincronizacion.ultimo_envio === null;
  return t.alertas.filter(
    (a) =>
      SEVERIDADES_AVISO.includes(a.severidad) &&
      !(nuncaConectado && a.codigo === 'SINCRONIZACION_VIEJA'),
  );
}

export function avisoDeAlertas(t: TableroGoogleAdsDto): AvisoCorreo | null {
  const alertas = alertasParaAvisar(t);
  if (alertas.length === 0) return null;
  const asunto = `Google Ads: ${alertas.length} alerta(s) que piden acción`;
  const texto = [
    `${asunto}.`,
    ...alertas.map((a) => `- ${a.titulo}. ${a.detalle} Qué hacer: ${a.accion}`),
    `Tablero: ${URL_TABLERO_GOOGLE_ADS}`,
  ].join('\n');
  const items = alertas
    .map(
      (a) =>
        `<li><strong>${escaparHtml(a.titulo)}</strong><br>${escaparHtml(
          a.detalle,
        )}<br><em>Qué hacer:</em> ${escaparHtml(a.accion)}</li>`,
    )
    .join('');
  const html = `<p>${escaparHtml(asunto)}.</p><ul>${items}</ul><p><a href="${URL_TABLERO_GOOGLE_ADS}">Ver el tablero de Google Ads</a></p>`;
  return { asunto, texto, html };
}
