import { contextoHttp, normalizarAtribucion } from './atribucion-web';

const HTTP = { ip: '181.50.1.2', userAgent: 'Mozilla/5.0' };

describe('normalizarAtribucion', () => {
  it('guarda cookies de Meta, UTM, URL sin query, IP y navegador', () => {
    expect(
      normalizarAtribucion(
        {
          fbp: 'fb.1.1596403881668.1116446470',
          fbc: 'fb.1.1554763741205.AbCdEf-12_3',
          url: 'https://pizzeriahorebs.shop/checkout?correo=ana@x.co',
          utm_source: 'facebook',
          utm_campaign: 'miercoles',
        },
        HTTP,
      ),
    ).toEqual({
      fbp: 'fb.1.1596403881668.1116446470',
      fbc: 'fb.1.1554763741205.AbCdEf-12_3',
      url: 'https://pizzeriahorebs.shop/checkout',
      utm_source: 'facebook',
      utm_campaign: 'miercoles',
      ip: '181.50.1.2',
      user_agent: 'Mozilla/5.0',
    });
  });

  it('descarta en silencio cookies mal formadas y URLs de otro sitio', () => {
    expect(
      normalizarAtribucion(
        { fbp: 'cualquier cosa', fbc: 123, url: 'https://otro.com/x' },
        undefined,
      ),
    ).toBeNull();
  });

  it('un body sin atribución igual guarda IP y navegador', () => {
    expect(normalizarAtribucion(undefined, HTTP)).toEqual({
      ip: '181.50.1.2',
      user_agent: 'Mozilla/5.0',
    });
  });

  it('recorta valores demasiado largos', () => {
    const atribucion = normalizarAtribucion(
      { utm_campaign: 'x'.repeat(900) },
      undefined,
    );
    expect(atribucion?.utm_campaign).toHaveLength(500);
  });
});

describe('contextoHttp', () => {
  it('toma la primera IP de x-forwarded-for (proxy de Railway)', () => {
    expect(
      contextoHttp({
        headers: {
          'x-forwarded-for': '181.50.1.2, 10.0.0.1',
          'user-agent': 'Mozilla/5.0',
        },
        socket: { remoteAddress: '10.0.0.9' },
      }),
    ).toEqual({ ip: '181.50.1.2', userAgent: 'Mozilla/5.0' });
  });

  it('sin proxy usa la IP del socket', () => {
    expect(
      contextoHttp({ headers: {}, socket: { remoteAddress: '127.0.0.1' } }),
    ).toEqual({ ip: '127.0.0.1', userAgent: null });
  });
});
