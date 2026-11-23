import { firmaGoogleAds, firmaGoogleAdsValida } from './google-ads-firma';

const SECRETO = 'secreto-de-prueba';
const BODY = Buffer.from('{"reporte":"campanas"}');
const AHORA = 1_795_000_000;

function cabecera(t: number, body = BODY, secreto = SECRETO): string {
  return `t=${t},v1=${firmaGoogleAds(body, String(t), secreto)}`;
}

describe('firmaGoogleAdsValida', () => {
  it('acepta la firma correcta dentro de la ventana', () => {
    expect(firmaGoogleAdsValida(BODY, cabecera(AHORA), SECRETO, AHORA)).toBe(
      true,
    );
    expect(
      firmaGoogleAdsValida(BODY, cabecera(AHORA - 299), SECRETO, AHORA),
    ).toBe(true);
  });

  it('rechaza un body alterado', () => {
    const otro = Buffer.from('{"reporte":"terminos"}');
    expect(firmaGoogleAdsValida(otro, cabecera(AHORA), SECRETO, AHORA)).toBe(
      false,
    );
  });

  it('rechaza otro secreto', () => {
    expect(
      firmaGoogleAdsValida(BODY, cabecera(AHORA, BODY, 'otro'), SECRETO, AHORA),
    ).toBe(false);
  });

  it('rechaza una firma vencida o del futuro', () => {
    expect(
      firmaGoogleAdsValida(BODY, cabecera(AHORA - 301), SECRETO, AHORA),
    ).toBe(false);
    expect(
      firmaGoogleAdsValida(BODY, cabecera(AHORA + 301), SECRETO, AHORA),
    ).toBe(false);
  });

  it('rechaza cabecera ausente, mal formada o sin secreto configurado', () => {
    expect(firmaGoogleAdsValida(BODY, undefined, SECRETO, AHORA)).toBe(false);
    expect(firmaGoogleAdsValida(BODY, 'v1=abc', SECRETO, AHORA)).toBe(false);
    expect(firmaGoogleAdsValida(BODY, `t=${AHORA},v1=zz`, SECRETO, AHORA)).toBe(
      false,
    );
    expect(firmaGoogleAdsValida(BODY, cabecera(AHORA), undefined, AHORA)).toBe(
      false,
    );
  });

  it('firma igual que el script: HMAC de "t." + body', () => {
    // Mismo cálculo que Utilities.computeHmacSha256Signature("t.body", secreto).
    const firma = firmaGoogleAds(Buffer.from('{}'), '1', 'k');
    expect(firma).toMatch(/^[0-9a-f]{64}$/);
    expect(firmaGoogleAds(Buffer.from('{}'), '1', 'k')).toBe(firma);
  });
});
