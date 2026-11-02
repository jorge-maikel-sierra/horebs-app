import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Bold firma cada webhook con HMAC-SHA256 (hex) de base64(cuerpo crudo),
 * usando la llave secreta de integración, y la manda en `x-bold-signature`.
 * Se compara en tiempo constante.
 */
export function firmaBoldEsperada(rawBody: Buffer, secreto: string): string {
  const codificado = rawBody.toString('base64');
  return createHmac('sha256', secreto).update(codificado).digest('hex');
}

export function firmaBoldValida(
  rawBody: Buffer,
  firma: string | undefined,
  secreto: string,
): boolean {
  if (!firma) return false;
  const esperada = Buffer.from(firmaBoldEsperada(rawBody, secreto));
  const recibida = Buffer.from(firma.trim().toLowerCase());
  return (
    esperada.length === recibida.length && timingSafeEqual(esperada, recibida)
  );
}
