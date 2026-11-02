import { createHmac } from 'node:crypto';
import { firmaBoldEsperada, firmaBoldValida } from './bold-firma';

const SECRETO = 'llave-secreta-de-prueba';
const CUERPO = Buffer.from('{"type":"SALE_APPROVED","data":{"x":1}}');

describe('firma de los webhooks de Bold', () => {
  it('es el HMAC-SHA256 en hex del cuerpo en base64', () => {
    const base64 = CUERPO.toString('base64');
    const manual = createHmac('sha256', SECRETO).update(base64).digest('hex');

    expect(firmaBoldEsperada(CUERPO, SECRETO)).toBe(manual);
  });

  it('acepta la firma correcta, también en mayúsculas o con espacios', () => {
    const firma = firmaBoldEsperada(CUERPO, SECRETO);

    expect(firmaBoldValida(CUERPO, firma, SECRETO)).toBe(true);
    expect(firmaBoldValida(CUERPO, ` ${firma.toUpperCase()} `, SECRETO)).toBe(
      true,
    );
  });

  it('rechaza una firma distinta, de otra llave o con el cuerpo alterado', () => {
    const firma = firmaBoldEsperada(CUERPO, SECRETO);

    expect(firmaBoldValida(CUERPO, 'a'.repeat(firma.length), SECRETO)).toBe(
      false,
    );
    expect(firmaBoldValida(CUERPO, firma, 'otra-llave')).toBe(false);
    expect(firmaBoldValida(Buffer.from('{"type":"x"}'), firma, SECRETO)).toBe(
      false,
    );
  });

  it('rechaza una firma ausente, vacía o de otro largo', () => {
    expect(firmaBoldValida(CUERPO, undefined, SECRETO)).toBe(false);
    expect(firmaBoldValida(CUERPO, '', SECRETO)).toBe(false);
    expect(firmaBoldValida(CUERPO, 'abc', SECRETO)).toBe(false);
  });
});
