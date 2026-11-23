import { createHmac, timingSafeEqual } from 'node:crypto';

/** Ventana anti-reenvío: un envío firmado vale 5 minutos. */
export const TOLERANCIA_FIRMA_SEGUNDOS = 300;

const FORMATO_FIRMA = /^t=(\d{9,11}),v1=([0-9a-f]{64})$/;

/**
 * El Google Ads Script firma `"<t>.<body crudo>"` con HMAC-SHA256 (hex) y la
 * manda en `x-horebs-firma: t=<unix>,v1=<hex>`. El timestamp va dentro de la
 * firma para que un envío capturado no se pueda repetir días después.
 */
export function firmaGoogleAds(
  rawBody: Buffer,
  timestamp: string,
  secreto: string,
): string {
  return createHmac('sha256', secreto)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest('hex');
}

export function firmaGoogleAdsValida(
  rawBody: Buffer,
  cabecera: string | undefined,
  secreto: string | undefined,
  ahoraSegundos: number,
): boolean {
  if (!secreto || !cabecera) return false;
  const m = FORMATO_FIRMA.exec(cabecera.trim().toLowerCase());
  if (!m) return false;
  const [, timestamp, recibidaHex] = m;
  if (Math.abs(ahoraSegundos - Number(timestamp)) > TOLERANCIA_FIRMA_SEGUNDOS) {
    return false;
  }
  const esperada = Buffer.from(firmaGoogleAds(rawBody, timestamp, secreto));
  const recibida = Buffer.from(recibidaHex);
  return (
    esperada.length === recibida.length && timingSafeEqual(esperada, recibida)
  );
}
